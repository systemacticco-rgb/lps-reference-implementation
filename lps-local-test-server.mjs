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
// Needs your normal .env (Supabase keys; SIGNING_ENABLED=true).
// ============================================================

import { createServer } from 'http';
import { generateManifest } from './manifestGenerator.mjs';
import { embedManifest } from './embeddingLayer.mjs';
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
      const { text } = await readBody(req);
      if (typeof text !== 'string' || !text.length) return json(res, 400, { error: 'No text provided' });
      const result = await verifyManifest(text);
      return json(res, 200, result);
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
      const embedded = embedManifest(visibleText, signed);

      return json(res, 200, {
        embedded,
        signed_manifest_preview: {
          has_signature: !!(signed && signed.signature),
          cert_url: signed && signed.cert_url,
          algorithm: signed && signed.algorithm,
          text_hash: manifest.text_hash,
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
<p class="note">Runs your real modules. EMBED here, copy out, round-trip through a destination app, paste back into VERIFY.</p>

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
 <label>Paste text to verify (fresh embed, or after a round trip)</label>
 <textarea id="ver" rows="2" placeholder="Paste here…"></textarea>
 <button onclick="doVerify()">Verify</button>
 <div id="verBadge" style="margin-top:12px"></div>
 <pre id="verOut" style="display:none"></pre>
</div>

<script>
function post(url,obj){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}).then(function(r){return r.json()});}
function doEmbed(){
  var vis=document.getElementById('vis').value;var segRaw=document.getElementById('seg').value;var out=document.getElementById('embOut');
  var seg;try{seg=JSON.parse(segRaw);}catch(e){out.style.display='block';out.textContent='Segments JSON is invalid: '+e.message;return;}
  post('/api/embed',{visibleText:vis,segments:seg}).then(function(d){
    out.style.display='block';
    if(d.embedded){
      out.textContent=JSON.stringify(d.signed_manifest_preview,null,2);
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
  post('/api/verify',{text:text}).then(function(d){
    out.style.display='block';out.textContent=JSON.stringify(d,null,2);
    if(d.status){badge.innerHTML='<span class="badge '+d.status+'">'+d.status.toUpperCase()+'</span>';}
    else{badge.innerHTML='';}
  }).catch(function(e){out.style.display='block';out.textContent='Request failed: '+e;});
}
</script>
</body></html>`;