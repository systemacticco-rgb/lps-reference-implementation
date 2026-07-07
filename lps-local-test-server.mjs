// ============================================================
// lps-local-test-server.mjs — local end-to-end test rig
// ============================================================
// Drop this file in the repository ROOT (same folder as
// manifestGenerator.mjs, embeddingLayer.mjs, verificationTool.mjs,
// signingLayer.mjs, compression.mjs, registryClient.mjs).
//
// Run:   node lps-local-test-server.mjs
// Open:  http://localhost:4173
//
// VERIFY side calls your real verifyManifest() — works now.
// EMBED side calls generateManifest -> signingLayer -> embedManifest.
//   It dynamic-imports signingLayer.mjs and looks for an exported
//   sign function. If your export name differs, it returns a clear
//   message listing what your module actually exports, so you can
//   tell me the correct name (no crash, server still boots).
//
// Local survival testing should not require network verification.
// SIGNING_ENABLED=true is still required for the real root signer.
// ============================================================

import { createServer } from 'http';
import { appendFileSync } from 'fs';
import { generateManifest } from './manifestGenerator.mjs';
import { embedManifestWithDiagnostics } from './embeddingLayer.mjs';
import { verifyManifest } from './verificationTool.mjs';

const PORT = 4173;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// Resolve the signing function from signingLayer.mjs without knowing its exact name
async function resolveSigner() {
  const mod = await import('./signingLayer.mjs');
  const candidate = mod.signManifest || mod.sign || mod.signLayer || mod.default;
  return { fn: typeof candidate === 'function' ? candidate : null, exported: Object.keys(mod) };
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/verify') {
    try {
      const { text, source, expected } = await readBody(req);
      if (typeof text !== 'string' || !text.length) return json(res, 400, { error: 'No text provided' });
      const result = await verifyManifest(text, { allowLocalCert: true, skipRegistry: true });
      const survivalRow = buildSurvivalAnalysis({ result, text, source, expected });
      try {
        appendFileSync('verification-log.jsonl', JSON.stringify(survivalRow) + '\n');
      } catch { /* non-fatal */ }
      return json(res, 200, {
        ...result,
        survival_analysis: survivalRow
      });
    } catch (e) {
      return json(res, 500, { error: 'verifyManifest threw', detail: String(e && e.message || e) });
    }
  }

  if (req.method === 'POST' && req.url === '/api/embed') {
    try {
      const { visibleText, segments } = await readBody(req);
      if (typeof visibleText !== 'string' || !visibleText.length) return json(res, 400, { error: 'No visibleText' });
      if (!Array.isArray(segments) || !segments.length) return json(res, 400, { error: 'segments must be a non-empty array' });

      const manifest = generateManifest({
        visibleText,
        segments,
        signingTool: 'lps-reference-implementation-v0.1',
        signedAt: new Date().toISOString(),
      });

      const { fn, exported } = await resolveSigner();
      if (!fn) {
        return json(res, 200, {
          error: 'Could not find a sign function in signingLayer.mjs',
          hint: 'Tell me which of these is the signer (or paste its export line):',
          exports: exported,
          unsigned_manifest: manifest,
        });
      }

      const signed = await fn(manifest);              // sync or async both fine
      const embedded = embedManifestWithDiagnostics(visibleText, signed);

      return json(res, 200, {
        embedded: embedded.text,
        embedding_diagnostics: {
          embedding_method_used: embedded.embedding_method_used,
          manifest_byte_size: embedded.manifest_byte_size,
          visible_text_length: embedded.visible_text_length,
          embedded_text_length: embedded.text.length,
          wrapper_worst_case_utf8_bytes: embedded.wrapper_worst_case_utf8_bytes ?? null,
          structured_exclusion_start: embedded.structured_exclusion_start ?? null,
          structured_exclusion_length: embedded.structured_exclusion_length ?? null
        },
        signed_manifest_preview: {
          has_signature: !!(signed && signed.signature),
          cert_url: signed && signed.cert_url,
          cert_fingerprint_present: !!(signed && signed.cert_fingerprint),
          algorithm: signed && signed.algorithm,
          text_hash: manifest.text_hash,
          text_length: manifest.text_length,
          overall_ai_proportion: manifest.overall_ai_proportion,
          human_proportion: manifest.human_proportion,
        },
      });
    } catch (e) {
      return json(res, 500, { error: 'embed pipeline threw', detail: String(e && e.message || e) });
    }
  }

  res.writeHead(404); res.end('not found');
});

function buildSurvivalAnalysis({ result, text, source = {}, expected = {} }) {
  const status = result?.status ?? 'unknown';
  const reason = result?.reason ?? null;
  const manifestSurvived = ['verified', 'failed'].includes(status)
    && reason !== 'Certificate URL not permitted — must be an allowed HTTPS host or the local test cert.pem'
    && reason !== 'Certificate URL not permitted — must be https and match an allowed host'
    && reason !== 'Certificate fetch or signature verification failed — check network or certificate URL';
  const signatureSurvived = status === 'verified'
    || reason === 'Visible text was modified after signing — content hash does not match'
    || reason === 'Visible text was modified after signing — content hash does not match. Original manifest withheld: received text length differs from signed text length beyond the disclosure threshold.';

  return {
    tested_at: new Date().toISOString(),
    editor: cleanTextField(source.editor),
    platform: cleanTextField(source.platform),
    copy_path: cleanTextField(source.copyPath),
    notes: cleanTextField(source.notes),
    status,
    reason,
    manifest_survived: manifestSurvived,
    signature_survived: signatureSurvived,
    visible_text_changed: status === 'failed' && reason?.startsWith('Visible text was modified after signing'),
    embedding_method_expected: cleanTextField(expected.embeddingMethod),
    embedding_method_recovered: result?.embedding_method_used ?? null,
    original_text_length: Number.isInteger(expected.visibleTextLength) ? expected.visibleTextLength : null,
    pasted_text_length: text.length,
    signed_text_length: result?.signed_text_length ?? null,
    received_text_length: result?.received_text_length ?? null,
    disclosure_threshold_outcome: result?.disclosure_threshold_outcome ?? null,
    trailing_artifact: (() => {
      const clean = result?.clean_text ?? null;
      const signedLen = result?.signed_text_length ?? null;
      if (!clean || signedLen === null) return null;
      const tail = clean.slice(signedLen);
      if (!tail.length) return null;
      return {
        raw: tail,
        char_codes: [...tail].map(c => c.codePointAt(0))
      };
    })()
  };
}

function cleanTextField(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('LPS local test rig → http://localhost:' + PORT);
  console.log('VERIFY uses your real verifyManifest(). EMBED uses generateManifest -> signingLayer -> embedManifest.');
});

// ------------------------------------------------------------
// Browser UI (no template literals inside the page script,
// to keep this server string clean)
// ------------------------------------------------------------
const PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>LPS Local Test Rig</title>
<style>
 :root{--bg:#1c1b1a;--card:#242a33;--type:#f2f0ec;--dim:#9aa0a8;--good:#4a8c5f;--bad:#9c4646;--warn:#9c7d3f;--line:#3a3d45;--accent:#33536a}
 *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--type);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:26px;max-width:940px;margin:auto}
 h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:20px 0 8px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
 p.note{color:var(--dim);font-size:13px;margin:6px 0 0}
 .card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin:10px 0}
 textarea{width:100%;background:#1a1f26;color:var(--type);border:1px solid var(--line);border-radius:6px;padding:10px;font:13px/1.45 ui-monospace,Menlo,monospace;resize:vertical}
 label{display:block;font-size:12px;color:var(--dim);margin:0 0 5px}
 button{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:14px;cursor:pointer;margin-top:10px;margin-right:8px}
 button:hover{filter:brightness(1.12)}
 pre{background:#1a1f26;border:1px solid var(--line);border-radius:6px;padding:12px;overflow:auto;font-size:12.5px;white-space:pre-wrap;word-break:break-word}
 .badge{display:inline-block;padding:3px 10px;border-radius:5px;font-size:13px;font-weight:600}
 .verified{background:var(--good)}.failed{background:var(--bad)}.degraded{background:var(--warn)}.registry_required{background:var(--accent)}
 code{background:#1a1f26;padding:1px 5px;border-radius:4px;font-size:12px}
</style></head><body>
<h1>LPS Local Test Rig</h1>
<p class="note">Runs the root LPS modules locally. EMBED here, copy out, round-trip through an editor, paste back into VERIFY, then copy the survival row.</p>

<div class="card">
 <h2>Embed — generate · sign · embed</h2>
 <label>Visible text</label>
 <textarea id="vis" rows="2">The quarterly figures show a 14% increase in retention.</textarea>
 <label style="margin-top:10px">Segments (generateManifest shape)</label>
 <textarea id="seg" rows="6">[
  {"segmentId":"s001","startOffset":0,"endOffset":53,"origin":"human","confidence":95}
]</textarea>
 <button onclick="doEmbed()">Embed</button>
 <pre id="embOut" style="display:none"></pre>
 <div id="embCopyWrap" style="display:none">
   <label style="margin-top:10px">Embedded text — copy this (looks plain, payload is invisible)</label>
   <textarea id="embText" rows="2" readonly></textarea>
   <button onclick="copyEmb()">Copy embedded text</button><span id="cpd" class="note"></span>
 </div>
</div>

<div class="card">
 <h2>Verify — your real verifyManifest()</h2>
 <label>Editor / app tested</label>
 <textarea id="editor" rows="1" placeholder="Example: Google Docs, Word, Notion, Slack"></textarea>
 <label style="margin-top:10px">Platform</label>
 <textarea id="platform" rows="1" placeholder="Example: macOS Chrome, iOS app, Windows desktop"></textarea>
 <label style="margin-top:10px">Copy/paste path</label>
 <textarea id="copyPath" rows="2" placeholder="Example: browser copy → Google Docs paste → browser copy → verifier"></textarea>
 <label style="margin-top:10px">Notes</label>
 <textarea id="notes" rows="2" placeholder="Optional observations"></textarea>
 <label>Paste text to verify (fresh embed, or after a round trip)</label>
 <textarea id="ver" rows="2" placeholder="Paste here…"></textarea>
 <button onclick="doVerify()">Verify</button>
 <div id="verBadge" style="margin-top:12px"></div>
 <pre id="verOut" style="display:none"></pre>
 <label style="margin-top:10px">Survival row</label>
 <pre id="survOut" style="display:none"></pre>
 <button id="copySurvBtn" style="display:none" onclick="copySurvival()">Copy survival row</button>
</div>

<script>
function post(url,obj){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}).then(function(r){return r.json()});}
var lastEmbedDiagnostics=null;
var lastSurvivalRow=null;
function doEmbed(){
  var vis=document.getElementById('vis').value;var segRaw=document.getElementById('seg').value;var out=document.getElementById('embOut');
  var seg;try{seg=JSON.parse(segRaw);}catch(e){out.style.display='block';out.textContent='Segments JSON is invalid: '+e.message;return;}
  post('/api/embed',{visibleText:vis,segments:seg}).then(function(d){
    out.style.display='block';
    if(d.embedded){
      lastEmbedDiagnostics=d.embedding_diagnostics || null;
      out.textContent=JSON.stringify({embedding_diagnostics:d.embedding_diagnostics,signed_manifest_preview:d.signed_manifest_preview},null,2);
      document.getElementById('embCopyWrap').style.display='block';
      document.getElementById('embText').value=d.embedded;
    }else{
      document.getElementById('embCopyWrap').style.display='none';
      out.textContent=JSON.stringify(d,null,2);
    }
  }).catch(function(e){out.style.display='block';out.textContent='Request failed: '+e;});
}
function copyEmb(){var t=document.getElementById('embText');t.select();t.setSelectionRange(0,t.value.length);
  navigator.clipboard.writeText(t.value).then(function(){document.getElementById('cpd').textContent=' copied ✓';},
  function(){document.getElementById('cpd').textContent=' (select-all + Cmd/Ctrl-C)';});}
function doVerify(){
  var text=document.getElementById('ver').value;var badge=document.getElementById('verBadge');var out=document.getElementById('verOut');
  var source={
    editor:document.getElementById('editor').value,
    platform:document.getElementById('platform').value,
    copyPath:document.getElementById('copyPath').value,
    notes:document.getElementById('notes').value
  };
  var expected={
    embeddingMethod:lastEmbedDiagnostics && lastEmbedDiagnostics.embedding_method_used,
    visibleTextLength:lastEmbedDiagnostics && lastEmbedDiagnostics.visible_text_length
  };
  post('/api/verify',{text:text,source:source,expected:expected}).then(function(d){
    out.style.display='block';out.textContent=JSON.stringify(d,null,2);
    if(d.status){badge.innerHTML='<span class="badge '+d.status+'">'+d.status.toUpperCase()+'</span>';}
    else{badge.innerHTML='';}
    lastSurvivalRow=d.survival_analysis || null;
    var surv=document.getElementById('survOut');
    if(lastSurvivalRow){
      surv.style.display='block';surv.textContent=JSON.stringify(lastSurvivalRow,null,2);
      document.getElementById('copySurvBtn').style.display='inline-block';
    }else{
      surv.style.display='none';document.getElementById('copySurvBtn').style.display='none';
    }
  }).catch(function(e){out.style.display='block';out.textContent='Request failed: '+e;});
}
function copySurvival(){
  if(!lastSurvivalRow){return;}
  navigator.clipboard.writeText(JSON.stringify(lastSurvivalRow));
}
</script>
</body></html>`;
