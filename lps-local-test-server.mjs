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
      const { visibleText, segments, payloadProfile } = await readBody(req);
      if (typeof visibleText !== 'string' || !visibleText.length) return json(res, 400, { error: 'No visibleText' });
      if (!Array.isArray(segments) || !segments.length) return json(res, 400, { error: 'segments must be a non-empty array' });

      const payloadProfileName = normalizeLocalPayloadProfile(payloadProfile);
      const payloadSegmentCount = localPayloadSegmentCount(payloadProfileName);
      const manifest = applyLocalPayloadProfile(generateManifest({
        visibleText,
        segments,
        signingTool: 'lps-reference-implementation-v0.1',
        signedAt: new Date().toISOString(),
      }), payloadProfileName);

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
          payload_profile: payloadProfileName,
          synthetic_segment_count: payloadSegmentCount,
          visible_text_length: embedded.visible_text_length,
          embedded_text_length: embedded.text.length,
          carrier_codepoints: countInvisibleCarrierCodepoints(embedded.text).carrier_codepoint_count,
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
          content_segment_count: Array.isArray(manifest.content_segments) ? manifest.content_segments.length : null,
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
  const embeddingDiagnostics = expected?.embedding_diagnostics && typeof expected.embedding_diagnostics === 'object'
    ? expected.embedding_diagnostics
    : {};
  const observedCarrier = countInvisibleCarrierCodepoints(text);
  const visibleTextLengthExpected = integerOrNull(embeddingDiagnostics.visible_text_length);
  const embeddedTextLengthExpected = integerOrNull(embeddingDiagnostics.embedded_text_length);
  const carrierCodepointsExpected = integerOrNull(embeddingDiagnostics.carrier_codepoints);
  const invisibleOverheadCharsExpected = carrierCodepointsExpected;
  const carrierRetentionRatio = carrierCodepointsExpected > 0
    ? observedCarrier.carrier_codepoint_count / carrierCodepointsExpected
    : null;
  const manifestSurvived = ['verified', 'failed'].includes(status)
    && reason !== 'Certificate URL not permitted — must be an allowed HTTPS host or the local test cert.pem'
    && reason !== 'Certificate URL not permitted — must be https and match an allowed host'
    && reason !== 'Certificate fetch or signature verification failed — check network or certificate URL';
  const signatureSurvived = status === 'verified'
    || reason === 'Visible text was modified after signing — content hash does not match'
    || reason === 'Visible text was modified after signing — content hash does not match. Original manifest withheld: received text length differs from signed text length beyond the disclosure threshold.';

  return {
    tested_at: new Date().toISOString(),
    test_id: cleanTextField(expected.test_id),
    payload_profile: cleanTextField(expected.payload_profile),
    editor: cleanTextField(source.editor),
    platform: cleanTextField(source.platform),
    copy_path: cleanTextField(source.copyPath),
    notes: cleanTextField(source.notes),
    status,
    reason,
    manifest_survived: manifestSurvived,
    signature_survived: signatureSurvived,
    visible_text_changed: status === 'failed' && reason?.startsWith('Visible text was modified after signing'),
    embedding_method_expected: cleanTextField(embeddingDiagnostics.embedding_method_used),
    embedding_method_recovered: result?.embedding_method_used ?? null,
    manifest_byte_size_expected: integerOrNull(embeddingDiagnostics.manifest_byte_size),
    wrapper_worst_case_utf8_bytes_expected: integerOrNull(embeddingDiagnostics.wrapper_worst_case_utf8_bytes),
    visible_text_length_expected: visibleTextLengthExpected,
    embedded_text_length_expected: embeddedTextLengthExpected,
    invisible_overhead_chars_expected: invisibleOverheadCharsExpected,
    original_text_length: visibleTextLengthExpected,
    pasted_text_length: text.length,
    signed_text_length: result?.signed_text_length ?? null,
    received_text_length: result?.received_text_length ?? null,
    zwnbsp_observed: observedCarrier.zwnbsp_count,
    variation_selectors_observed: observedCarrier.variation_selector_count,
    carrier_codepoints_observed: observedCarrier.carrier_codepoint_count,
    carrier_codepoints_expected: carrierCodepointsExpected,
    carrier_retention_ratio: carrierRetentionRatio,
    carrier_stripped_completely: carrierCodepointsExpected > 0 && observedCarrier.carrier_codepoint_count === 0,
    carrier_damaged_partial: carrierCodepointsExpected > 0 && observedCarrier.carrier_codepoint_count > 0 && status !== 'verified',
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

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

function applyLocalPayloadProfile(manifest, payloadProfile) {
  const syntheticSegmentCount = localPayloadSegmentCount(payloadProfile);
  if (!syntheticSegmentCount) return manifest;

  return {
    ...manifest,
    content_segments: [
      ...(Array.isArray(manifest.content_segments) ? manifest.content_segments : []),
      ...localPayloadSegments(payloadProfile, syntheticSegmentCount)
    ]
  };
}

function normalizeLocalPayloadProfile(payloadProfile) {
  if (typeof payloadProfile !== 'string') return 'baseline';
  const profile = payloadProfile.trim().toLowerCase();
  return profile || 'baseline';
}

function localPayloadSegmentCount(payloadProfile) {
  const profile = normalizeLocalPayloadProfile(payloadProfile);
  if (!profile || profile === 'baseline') return 0;

  const namedProfiles = {
    '1kb': 12,
    '2kb': 25,
    '5kb': 70,
    '10kb': 145
  };
  if (Object.hasOwn(namedProfiles, profile)) return namedProfiles[profile];

  const match = profile.match(/^(\d+)\s*(kb|kib|b|bytes)?$/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const targetBytes = match[2] === 'b' || match[2] === 'bytes'
    ? amount
    : amount * 1024;
  return Math.max(1, Math.ceil((targetBytes - 450) / 66));
}

function localPayloadSegments(payloadProfile, count) {
  const segments = [];
  let seed = 0x811c9dc5;
  const seedText = payloadProfile + ':' + count;
  for (const char of seedText) {
    seed = Math.imul(seed ^ char.codePointAt(0), 16777619) >>> 0;
  }

  for (let i = 0; i < count; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    segments.push({
      segment_id: 'local_payload_' + i.toString(36) + '_' + seed.toString(36),
      start_offset: 0,
      end_offset: 0,
      origin: 'human',
      confidence: seed % 101,
      confidence_source: 'local_survival_study_' + normalizeLocalPayloadProfile(payloadProfile) + '_' + seed.toString(36)
    });
  }
  return segments;
}

function countInvisibleCarrierCodepoints(value) {
  let zwnbsp_count = 0;
  let variation_selector_count = 0;

  if (typeof value !== 'string') {
    return { zwnbsp_count, variation_selector_count, carrier_codepoint_count: 0 };
  }

  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === 0xFEFF) {
      zwnbsp_count += 1;
    }
    if (
      (codePoint >= 0xFE00 && codePoint <= 0xFE0F)
      || (codePoint >= 0xE0100 && codePoint <= 0xE01EF)
    ) {
      variation_selector_count += 1;
    }
  }

  return {
    zwnbsp_count,
    variation_selector_count,
    carrier_codepoint_count: zwnbsp_count + variation_selector_count
  };
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
 textarea,select{width:100%;background:#1a1f26;color:var(--type);border:1px solid var(--line);border-radius:6px;padding:10px;font:13px/1.45 ui-monospace,Menlo,monospace;resize:vertical}
	 label{display:block;font-size:12px;color:var(--dim);margin:0 0 5px}
	 button{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:14px;cursor:pointer;margin-top:10px;margin-right:8px}
	 button:hover{filter:brightness(1.12)}
	 button.loading{filter:brightness(.75)}
	 button.copy-active{filter:brightness(.75)}
	 .spinner{display:inline-block;width:1em;height:1em;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;vertical-align:-.15em;animation:spin .8s linear infinite}
	 @keyframes spin{to{transform:rotate(360deg)}}
	 pre{background:#1a1f26;border:1px solid var(--line);border-radius:6px;padding:12px;overflow:auto;font-size:12.5px;white-space:pre-wrap;word-break:break-word}
	 .badge{display:inline-block;padding:3px 10px;border-radius:5px;font-size:13px;font-weight:600}
	 .verified{background:var(--good)}.failed{background:var(--bad)}.degraded{background:var(--warn)}.registry_required{background:var(--accent)}
	 .payload-warning{color:var(--warn);font-size:13px;font-weight:600;margin:8px 0 0}
	 .copy-confirm{display:inline-block;opacity:0;transition:opacity 1.5s ease;color:var(--good)}
	 .copy-confirm.visible{opacity:1}
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
 <label style="margin-top:10px">Payload profile</label>
 <select id="payloadProfile">
   <option value="baseline">baseline</option>
   <option value="1kb">1kb</option>
   <option value="2kb">2kb</option>
   <option value="5kb">5kb</option>
   <option value="10kb">10kb</option>
	   <option value="custom">custom</option>
	 </select>
	 <textarea id="payloadProfileCustom" rows="1" placeholder="Custom payload profile" style="display:none;margin-top:8px"></textarea>
	 <p id="payloadProfileWarning" class="payload-warning" style="display:none">Manifests over this size create copy-paste latency in some editors. This is a stress-test profile, not a production scenario.</p>
	 <button id="embedBtn" onclick="doEmbed()">Embed</button>
	 <p id="manifestSize" class="note"></p>
	 <pre id="embOut" style="display:none"></pre>
	 <div id="embCopyWrap" style="display:none">
	   <label style="margin-top:10px">Embedded text — copy this (looks plain, payload is invisible)</label>
	   <textarea id="embText" rows="2" readonly></textarea>
	   <button id="copyEmbBtn" onclick="copyEmb()">Copy embedded text</button><span id="cpd" class="note copy-confirm"></span>
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
	 <button id="verifyBtn" onclick="doVerify()">Verify</button>
	 <div id="verBadge" style="margin-top:12px"></div>
	 <pre id="verOut" style="display:none"></pre>
	 <label style="margin-top:10px">Survival row</label>
	 <pre id="survOut" style="display:none"></pre>
	 <button id="copySurvBtn" style="display:none" onclick="copySurvival()">Copy survival row</button><span id="survCpd" class="note copy-confirm"></span>
	</div>

<script>
function post(url,obj){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}).then(function(r){return r.json()});}
var lastEmbedDiagnostics=null;
var lastTestId=null;
	var lastSurvivalRow=null;
	document.getElementById('payloadProfile').addEventListener('change',function(){
	  document.getElementById('payloadProfileCustom').style.display=this.value==='custom'?'block':'none';
	  updatePayloadProfileWarning();
	});
	document.getElementById('payloadProfileCustom').addEventListener('input',updatePayloadProfileWarning);
	updatePayloadProfileWarning();
	function currentPayloadProfile(){
	  var selected=document.getElementById('payloadProfile').value;
	  if(selected==='custom'){
	    return document.getElementById('payloadProfileCustom').value.trim() || null;
	  }
	  return selected;
	}
	function updatePayloadProfileWarning(){
	  var profile=(currentPayloadProfile() || '').toLowerCase();
	  document.getElementById('payloadProfileWarning').style.display=(profile==='5kb' || profile==='10kb')?'block':'none';
	}
	function withLoading(buttonId,action){
	  var btn=document.getElementById(buttonId);
	  var label=btn.innerHTML;
	  var width=btn.offsetWidth;
	  btn.style.minWidth=width+'px';
	  btn.innerHTML='<span class="spinner" aria-label="Loading"></span>';
	  btn.classList.add('loading');
	  btn.disabled=true;
	  window.setTimeout(function(){
	    btn.innerHTML=label;
	    btn.classList.remove('loading');
	    btn.disabled=false;
	    btn.style.minWidth='';
	    action();
	  },1000);
	}
	function darkenCopyButton(buttonId){
	  var btn=document.getElementById(buttonId);
	  btn.classList.add('copy-active');
	  window.setTimeout(function(){btn.classList.remove('copy-active');},1000);
	}
	function showCopyConfirmation(id,text){
	  var el=document.getElementById(id);
	  el.textContent=text;
	  el.classList.remove('visible');
	  window.requestAnimationFrame(function(){
	    el.classList.add('visible');
	    window.setTimeout(function(){el.classList.remove('visible');},1000);
	    window.setTimeout(function(){el.textContent='';},2500);
	  });
	}
	function doEmbed(){
	  var vis=document.getElementById('vis').value;var segRaw=document.getElementById('seg').value;var out=document.getElementById('embOut');
	  var seg;try{seg=JSON.parse(segRaw);}catch(e){out.style.display='block';out.textContent='Segments JSON is invalid: '+e.message;return;}
	  withLoading('embedBtn',function(){
	  post('/api/embed',{
	  visibleText: vis,
	  segments: seg,
  payloadProfile: currentPayloadProfile()
  }).then(function(d){
    out.style.display='block';
    if(d.embedded){
      lastEmbedDiagnostics=d.embedding_diagnostics || null;
      lastTestId='lps-survival-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
      out.textContent=JSON.stringify({embedding_diagnostics:d.embedding_diagnostics,signed_manifest_preview:d.signed_manifest_preview},null,2);
      document.getElementById('manifestSize').textContent=lastEmbedDiagnostics && Number.isInteger(lastEmbedDiagnostics.manifest_byte_size)
        ? 'Profile '+(lastEmbedDiagnostics.payload_profile || currentPayloadProfile() || 'baseline')+' · manifest '+lastEmbedDiagnostics.manifest_byte_size+' bytes'
        : '';
      document.getElementById('embCopyWrap').style.display='block';
      document.getElementById('embText').value=d.embedded;
    }else{
      lastEmbedDiagnostics=null;
      lastTestId=null;
      document.getElementById('manifestSize').textContent='';
      document.getElementById('embCopyWrap').style.display='none';
      out.textContent=JSON.stringify(d,null,2);
	    }
	  }).catch(function(e){out.style.display='block';out.textContent='Request failed: '+e;});
	  });
	}
	function copyEmb(){var t=document.getElementById('embText');t.select();t.setSelectionRange(0,t.value.length);
	  darkenCopyButton('copyEmbBtn');
	  navigator.clipboard.writeText(t.value).then(function(){showCopyConfirmation('cpd',' copied ✓');},
	  function(){showCopyConfirmation('cpd',' (select-all + Cmd/Ctrl-C)');});}
	function doVerify(){
	  var text=document.getElementById('ver').value;var badge=document.getElementById('verBadge');var out=document.getElementById('verOut');
	  var source={
    editor:document.getElementById('editor').value,
    platform:document.getElementById('platform').value,
    copyPath:document.getElementById('copyPath').value,
    notes:document.getElementById('notes').value
  };
  var expected={
    test_id:lastTestId,
	    payload_profile:currentPayloadProfile(),
	    embedding_diagnostics:lastEmbedDiagnostics
	  };
	  withLoading('verifyBtn',function(){
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
	  });
	}
	function copySurvival(){
	  if(!lastSurvivalRow){return;}
	  darkenCopyButton('copySurvBtn');
	  navigator.clipboard.writeText(JSON.stringify(lastSurvivalRow)).then(function(){showCopyConfirmation('survCpd',' copied ✓');},
	  function(){showCopyConfirmation('survCpd',' copy failed');});
	}
</script>
</body></html>`;
