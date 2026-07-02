You are implementing PROPOSAL 005 — Redundant Embedding with Anchor Layer
and Cross-Copy Reconstruction — for the LPS reference implementation.
This is a security-critical build. Read every instruction exactly.
Do not assume. Do not add. Do not remove. Follow the spec.

═══════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════

LPS is a provenance recording system that embeds a cryptographically
signed manifest into visible text using invisible Unicode characters.
The pipeline has four stages:
1. manifestGenerator.mjs — builds the manifest
2. signingLayer.mjs — signs the manifest
3. embeddingLayer.mjs — compresses, encodes, embeds into text
4. verificationTool.mjs — extracts, reconstructs, verifies

Supporting files: compression.mjs, registryClient.mjs,
confidenceFallback.mjs, chunkLayer.mjs (new), anchorLayer.mjs (new),
paragraphAnalysis.mjs (new)

The signed manifest after compress() + encodeToCBOR() produces
a binary buffer of approximately 737 bytes for a 3-segment document.
Chunk slice size is fixed at 8 bytes payload per chunk.
Chunk 001 carries 40 bytes payload — 32 checksum + 8 data.
All other chunks carry 8 bytes payload.
Header size is 11 bytes per chunk.
Total chunk size: 11 + payload bytes.

═══════════════════════════════════════════
WHAT YOU ARE BUILDING
═══════════════════════════════════════════
NOTE — signingLayer.mjs and verificationTool.mjs were already
modified prior to this build (June 30 2026) to use
dsaEncoding: 'ieee-p1363' for manifest signing and verification,
closing a JOSE/COSE encoding compliance gap. Do not modify
these two files' core sign/verify calls as part of this build.
anchorLayer.mjs has not yet been implemented. Before this build
begins, the HMAC key derivation approach must be confirmed as an
architectural decision. The current recommended direction is to
use Node's built-in crypto.hkdfSync rather than deriving key
material through a signing operation, as this follows a
well-established key-derivation primitive, introduces no
additional runtime dependencies, and reduces the likelihood of
cryptographic-review questions. Once this decision is confirmed,
all implementation details in FILE 2 must follow that approach.
This supersedes earlier draft prompts that referenced
createSign-based key derivation.
Two embedding layers on top of the existing A.8/A.9 system:

LAYER 1 — ANCHOR MANIFEST
Small. Repeated at every paragraph boundary.
Contains: text_hash, overall_ai_proportion, human_proportion,
algorithm, signed_at, anchor_hmac.
Never contains segments. Never contains signature or cert.
Embedded via A.8 at each paragraph start character.
HMAC computed using key derived from signing the fixed UTF-8
string 'lps-anchor-hmac-v0.1' with the existing private key
via signingLayer.mjs infrastructure. anchorLayer.mjs never
reads the private key file directly.

LAYER 2 — OVERLAPPING REDUNDANT FULL MANIFEST COPIES
One complete full manifest copy per paragraph.
Each copy embedded via A.9 across that paragraph's characters.
Copies overlap by exactly 25% of chunk range.
Overlap is intentional — same seq position exists in two
adjacent copies attached to different characters in different
paragraphs.
Copy distribution calculated by paragraphAnalysis.mjs before
any embedding begins.

═══════════════════════════════════════════
FILE 1 — CREATE chunkLayer.mjs
═══════════════════════════════════════════

Location: project root alongside existing .mjs files.

Magic prefix: Buffer.from([0x4C, 0x50, 0x53, 0x01])
Fixed. Never changes. Applied to every chunk and anchor buffer.

Header format — 11 bytes total:
  Bytes 0–3:  magic prefix (4 bytes)
  Bytes 4–5:  seq      uint16BE  position in full sequence
  Bytes 6–7:  total    uint16BE  total chunks in sequence
  Byte  8:    copy_id  uint8     which copy (A=1, B=2, C=3...)
                                 anchors use copy_id=0
  Byte  9:    version  uint8     fixed at 1
  Byte  10:   type     uint8     0=anchor, 1=full copy chunk

Export prependHeader(buffer, seq, total, copy_id, type):
  Validate: seq must be uint16 range 0–65535.
  Validate: total must be uint16 range 1–65535.
  Validate: copy_id must be uint8 range 0–255.
  Validate: type must be exactly 0 or 1.
  Throw descriptive error on any invalid input.
  Never silently accept bad values.
  Build header buffer from magic prefix plus fields.
  Return Buffer.concat([headerBuffer, buffer]).

Export parseHeader(buffer):
  If buffer.length < 11 return null.
  Check bytes 0–3 match magic prefix exactly.
  If magic mismatch return null. Not an LPS buffer.
  Read header fields from bytes 4–10.
  If version !== 1 return { version_mismatch: true,
    found_version: versionValue }.
  Validate type is 0 or 1. If not return null.
  Validate total > 0. If not return null.
  Return { seq, total, copy_id, version, type,
           payload: buffer.slice(11) }.

No other exports. No other functions.

═══════════════════════════════════════════
FILE 2 — CREATE anchorLayer.mjs
═══════════════════════════════════════════

Location: project root.

Import: compress from compression.mjs
Import: prependHeader, parseHeader from chunkLayer.mjs
Import: createSign, timingSafeEqual from crypto (Node built-in)
Import: readFileSync from fs

Export buildAnchor(signedManifest, privateKeyPath):
  Extract from signedManifest.manifest:
    text_hash, overall_ai_proportion, human_proportion,
    signed_at
  Extract from signedManifest:
    algorithm, signed_at (outer — use this one)
  Build anchorFields object with these six fields only.
  Derive HMAC key:

  Derive HMAC key material using Node's built-in
  crypto.hkdfSync('sha256', ikm, salt, info, 32).
  The input keying material (ikm) MUST be the root keying
  material defined by the finalized LPS key hierarchy
  specification. The implementation MUST NOT assume what
  constitutes the root secret until the architectural decision
  has been completed and documented.
  The salt, context binding (`info`), output length, and any
  future domain-separation strategy MUST follow the approved
  key-derivation specification rather than implementation
  convenience.
  This adopts the standard HKDF construction instead of
  reusing the signing primitive for deterministic key
  derivation, reducing reviewer friction while introducing
  no external dependencies (hkdfSync is built into Node.js).
  Once the key hierarchy has been finalized, this component
  must implement the approved specification exactly. Do not
  infer, substitute, or redesign the derivation strategy
  during implementation.

  Compute HMAC-SHA256 of JSON.stringify(anchorFields)
    using the derived key material.
    Add hmac field to anchorFields as hex string.
  Return anchorFields object with hmac included.
  Private key bytes must not appear in any log or error.
  Wrap key read in try/catch. Throw generic message on fail.

Export embedAnchor(anchorObject, text, position):
  Compress anchorObject using compress() from compression.mjs.
  Encode to CBOR using encodeToCBOR() from compression.mjs.
  Call prependHeader(buffer, 0, 1, 0, 0) — type=0, anchor.
  Embed resulting buffer via A.8 at character at position
  in text using embedManifest from c2pa-text with anchor
  positioned at the specified character offset.
  Return modified text with anchor embedded.
  Never modify visible characters.

Export verifyAnchorHMAC(anchorObject, privateKeyPath):
  Extract hmac field from anchorObject.
  Build anchorFields without hmac field.
  Derive same HMAC key using same method as buildAnchor().
  Recompute HMAC over JSON.stringify(anchorFields).
  Compare using timingSafeEqual() — never standard equality.
  Return true if match. Return false on any mismatch or error.
  Never throw. Catch all errors and return false.

No other exports. No other functions.

═══════════════════════════════════════════
FILE 3 — CREATE paragraphAnalysis.mjs
═══════════════════════════════════════════

Location: project root.

Export paragraphAnalysis(visibleText, paragraphBoundaries,
                          totalChunks):

  Step 1 — Validate boundaries.
  A boundary is valid if visibleText[boundary] is the first
  non-whitespace character after a newline sequence (\n or \r\n).
  Remove invalid boundaries from the array.
  Record removed boundaries in validation_log array.

  Step 2 — Fallback if no valid boundaries found.
  Generate synthetic boundaries at every 500 characters.
  Mark plan with synthetic_boundaries: true.

  Step 3 — Minimum viable threshold check.
  Each paragraph needs at least totalChunks/paragraphCount × 2
  visible characters to carry its assigned chunks.
  If a paragraph is too short — merge with next paragraph.
  Record each merge as { merged: [paragraphIndex, nextIndex] }
  in merge_log array.
  Repeat until all zones meet minimum threshold or only one
  zone remains.

  Step 4 — Calculate chunk ranges with 25% overlap.
  chunksPerCopy = ceil(totalChunks / zoneCount × 1.25)
  For each zone:
    copy_start = previous copy_start + floor(previous range × 0.75)
    copy_end = copy_start + chunksPerCopy - 1
    Clamp copy_end to totalChunks.
  First copy always starts at chunk 1.
  Last copy always ends at totalChunks.

  Step 5 — Minimum viable plan trigger.
  If total visible characters < totalChunks × 2:
    Return single zone covering full document.
    No overlap. One copy only.
    Flag minimum_viable_plan: true.

  Step 6 — Return copyDistributionPlan object:
  {
    zones: [
      {
        copy_id: number,
        start_chunk: number,
        end_chunk: number,
        char_start: number,
        char_end: number,
        paragraph_ids: number[]
      }
    ],
    merge_log: [],
    validation_log: [],
    synthetic_boundaries: boolean,
    minimum_viable_plan: boolean,
    total_chunks: totalChunks,
    overlap_percentage: 25
  }

No other exports. No other functions.

═══════════════════════════════════════════
FILE 4 — MODIFY embeddingLayer.mjs
═══════════════════════════════════════════

These are the only changes. Do not touch anything else.

Add imports at top:
  import { buildAnchor, embedAnchor } from './anchorLayer.mjs';
  import { paragraphAnalysis } from './paragraphAnalysis.mjs';
  import { prependHeader } from './chunkLayer.mjs';
  import { createHash } from 'crypto';

Change the exported function signature from:
  export function embedManifest(visibleText, signedManifest)
To:
  export function embedManifest(visibleText, signedManifest,
    paragraphBoundaries = [], privateKeyPath = './private.pem')

Add before the existing compress/encode block:

  // PROPOSAL 005 — compute payload checksum before chunking
  // Runs only when paragraphBoundaries provided and non-empty
  // Falls through to existing A.8/A.9 logic when no boundaries

  if (paragraphBoundaries.length > 0) {

    // Compress and encode full manifest to binary buffer
    const fullBuffer = encodeToCBOR(compress(signedManifest));

    // Compute SHA-256 of full buffer for chunk 001 checksum
    const bufferChecksum = createHash('sha256')
      .update(fullBuffer).digest();

    // Slice into chunks
    // Chunk 001: 32 bytes checksum + 8 bytes data = 40 bytes payload
    // All other chunks: 8 bytes payload
    const chunks = [];
    // Chunk 001
    const firstDataSlice = fullBuffer.slice(0, 8);
    const chunk001Payload = Buffer.concat([bufferChecksum,
      firstDataSlice]);
    chunks.push(chunk001Payload);
    // Remaining chunks
    let offset = 8;
    while (offset < fullBuffer.length) {
      chunks.push(fullBuffer.slice(offset, offset + 8));
      offset += 8;
    }
    const totalChunks = chunks.length;

    // Get copy distribution plan
    const plan = paragraphAnalysis(visibleText,
      paragraphBoundaries, totalChunks);

    let currentText = visibleText;

    // Embed anchor at each paragraph boundary
    for (const boundary of paragraphBoundaries) {
      const anchor = buildAnchor(signedManifest, privateKeyPath);
      currentText = embedAnchor(anchor, currentText, boundary);
    }

    // Embed full manifest copies per zone
    for (const zone of plan.zones) {
      const zoneChunks = chunks.slice(zone.start_chunk - 1,
        zone.end_chunk);
      for (let i = 0; i < zoneChunks.length; i++) {
        const seq = zone.start_chunk + i;
        const headed = prependHeader(zoneChunks[i], seq,
          totalChunks, zone.copy_id, 1);
        // Embed headed chunk via A.9 at calculated position
        // within zone character range
        // Character position: zone.char_start +
        // floor(i × (zone.char_end - zone.char_start)
        // / zoneChunks.length)
        const charPos = zone.char_start +
          Math.floor(i * (zone.char_end - zone.char_start)
          / zoneChunks.length);
        currentText = embedIntoText(currentText, headed,
          { method: 'structured', position: charPos });
          // Confirm c2pa-text accepts position parameter
        // If not, use manual split-embed-rejoin approach
        // Document which path was taken in comment below

        // EMBEDDING METHOD USED: [Claude Code fills this in after
        // confirming c2pa-text API during implementation]

        // Manual fallback if position parameter unsupported:
        // const before = currentText.slice(0, charPos);
        // const after = currentText.slice(charPos);
        // const embeddedChunk = embedIntoText(before, headed);
        // currentText = embeddedChunk + after;
      }
    }

    return currentText;
  }

  // Existing A.8/A.9 logic unchanged below this point
  // Runs when paragraphBoundaries is empty — backwards compatible

Keep the entire existing try/catch block below unchanged.

═══════════════════════════════════════════
FILE 5 — MODIFY verificationTool.mjs
═══════════════════════════════════════════

These are the only changes. Do not touch anything else.

Add imports at top:
  import { parseHeader } from './chunkLayer.mjs';
  import { verifyAnchorHMAC } from './anchorLayer.mjs';
  import { createHash } from 'crypto';
  (createHash already imported — skip if present)

Add the following internal functions before verifyManifest():

  // Separate extracted buffers into anchors and chunks
  function classifyBuffers(rawBuffers) {
    const anchors = [];
    const chunks = [];
    for (const buf of rawBuffers) {
      const parsed = parseHeader(buf);
      if (!parsed) continue;
      if (parsed.version_mismatch) continue;
      if (parsed.type === 0) anchors.push(parsed);
      if (parsed.type === 1) chunks.push(parsed);
    }
    return { anchors, chunks };
  }

  // Validate anchors — discard HMAC failures
  // Return consistent anchor fields or conflict report
  function validateAnchors(anchors, privateKeyPath) {
    const valid = [];
    for (const anchor of anchors) {
      const anchorObj = decodeFromCBOR(anchor.payload);
      const decompressed = decompress(anchorObj);
      const hmacValid = verifyAnchorHMAC(decompressed,
        privateKeyPath);
      if (hmacValid) valid.push(decompressed);
    }
    if (valid.length === 0) return null;
    const hashes = [...new Set(valid.map(a => a.text_hash))];
    if (hashes.length > 1) {
      return { conflict: true, text_hashes: hashes };
    }
    return { conflict: false, fields: valid[0] };
  }

  // Reconstruct full manifest buffer from chunks
  // Cross-copy deduplication by seq number
  // Conflict resolution by signature validity
  function reconstructFromChunks(chunks, anchorFields) {
    if (chunks.length === 0) return null;
    const total = chunks[0].total;
    const bySeq = {};
    for (const chunk of chunks) {
      if (!bySeq[chunk.seq]) bySeq[chunk.seq] = [];
      bySeq[chunk.seq].push(chunk);
    }
    const assembled = new Array(total).fill(null);
    const missingSeqs = [];
    for (let seq = 1; seq <= total; seq++) {
      const candidates = bySeq[seq] || [];
      if (candidates.length === 0) {
        missingSeqs.push(seq);
        continue;
      }
      // All candidates at same seq should be identical
      // If only one candidate take it directly
      if (candidates.length === 1) {
        assembled[seq - 1] = candidates[0].payload;
        continue;
      }
      // Multiple candidates — check agreement
      const allSame = candidates.every(c =>
        c.payload.equals(candidates[0].payload));
      if (allSame) {
        assembled[seq - 1] = candidates[0].payload;
        continue;
      }
      // Conflict — mark for signature resolution
      // Resolved after full assembly attempt
      assembled[seq - 1] = { conflict: true, candidates };
    }
    const completeness = Math.round(
      ((total - missingSeqs.length) / total) * 100);
    return {
      assembled,
      missingSeqs,
      total,
      completeness
    };
  }

  // Assemble buffer from resolved chunk array
  // Chunk 001 strips 32-byte checksum prefix before assembly
  function assembleBuffer(assembled) {
    const payloads = [];
    for (let i = 0; i < assembled.length; i++) {
      const chunk = assembled[i];
      if (!chunk || chunk.conflict) return null;
      if (i === 0) {
        // Chunk 001 — strip 32-byte checksum, keep data bytes
        payloads.push(chunk.slice(32));
      } else {
        payloads.push(chunk);
      }
    }
    return Buffer.concat(payloads);
  }

  // Validate buffer checksum against value in chunk 001
  function validateChecksum(assembled, fullBuffer) {
    if (!assembled[0]) return false;
    const storedChecksum = assembled[0].slice(0, 32);
    const computed = createHash('sha256')
      .update(fullBuffer).digest();
    return storedChecksum.equals(computed);
  }

Modify verifyManifest() — add PROPOSAL 005 extraction path
at the very beginning of the function before the existing
extracted = extractManifest(embeddedText) call:

  const privateKeyPath = './private.pem';
  let anchorLayerStatus = 'absent';
  let anchorFields = null;
  let sessionCertFingerprint = null;

After the existing extracted = extractManifest(embeddedText)
call and before the existing if (!extracted || !extracted.manifest)
block, add:

  // PROPOSAL 005 — classify all extracted buffers
  // extractManifest returns all embedded buffers
  // including anchors and redundant copy chunks
  let allBuffers = [];
  // c2pa-text may not expose allBuffers — scan manually
function extractAllLPSBuffers(text) {
  const magic = Buffer.from([0x4C, 0x50, 0x53, 0x01]);
  const found = [];
  // Extract all embedded buffers from text using extractManifest
  // repeatedly after removing each found buffer until none remain
  let remaining = text;
  while (true) {
    try {
      const result = extractManifest(remaining);
      if (!result || !result.manifest) break;
      found.push(result.manifest);
      // Remove found signal from remaining text to find next
      remaining = result.cleanText;
      if (remaining === text) break;
      text = remaining;
    } catch {
      break;
    }
  }
  return found;
}

allBuffers = extractAllLPSBuffers(embeddedText);
  const { anchors, chunks } = classifyBuffers(allBuffers);

  // Validate anchors
  if (anchors.length > 0) {
    const anchorResult = validateAnchors(anchors, privateKeyPath);
    if (anchorResult && anchorResult.conflict) {
      anchorLayerStatus = 'conflict';
      // Continue to chunk reconstruction — do not return yet
    } else if (anchorResult && !anchorResult.conflict) {
      anchorLayerStatus = 'present';
      anchorFields = anchorResult.fields;
    }
  }

  // Attempt chunk reconstruction if chunks found
  if (chunks.length > 0) {
    const recon = reconstructFromChunks(chunks, anchorFields);
    if (recon && recon.completeness < 50) {
      // Low confidence reconstruction
      return {
        status: 'partial_recovery',
        reconstruction_completeness: recon.completeness,
        low_confidence_reconstruction: true,
        missing_seq_positions: recon.missingSeqs,
        anchor_layer: anchorLayerStatus,
        anchor_fields: anchorFields ?? null
      };
    }
    if (recon && recon.missingSeqs.length > 0
        && recon.completeness >= 50) {
      const partialBuffer = assembleBuffer(recon.assembled);
      return {
        status: 'partial_recovery',
        reconstruction_completeness: recon.completeness,
        low_confidence_reconstruction: false,
        missing_seq_positions: recon.missingSeqs,
        anchor_layer: anchorLayerStatus,
        partial_manifest: partialBuffer
          ? 'reconstruction_attempted' : 'assembly_failed',
        anchor_fields: anchorFields ?? null
      };
    }
    if (recon && recon.missingSeqs.length === 0) {
      const fullBuffer = assembleBuffer(recon.assembled);
      if (!fullBuffer) {
        return {
          status: 'degraded',
          reason: 'Buffer assembly failed after reconstruction',
          anchor_layer: anchorLayerStatus
        };
      }
      const checksumValid = validateChecksum(
        recon.assembled, fullBuffer);
      if (!checksumValid) {
        return {
          status: 'degraded',
          reason: 'Reconstruction checksum mismatch —' +
                  ' buffer corrupted during assembly',
          anchor_layer: anchorLayerStatus
        };
      }
      // Buffer valid — decode and proceed to verification
      // Override extracted.manifest with reconstructed buffer
      extracted = { manifest: fullBuffer,
                    cleanText: extracted
                      ? extracted.cleanText : embeddedText };
    }
  }

  // If no chunks but anchors present — anchor_only
  if (chunks.length === 0 && anchorLayerStatus === 'present') {
    // Check registry before returning anchor_only
    const contentHash = createHash('sha256')
      .update(embeddedText, 'utf8').digest('hex');
    const registryRecord = await queryRegistry({ contentHash });
    if (registryRecord) {
      return {
        status: 'registry_required',
        reason: 'No embedded signal — registry record exists',
        anchor_layer: anchorLayerStatus,
        anchor_fields: anchorFields,
        registry_record: {
          token: registryRecord.token,
          content_hash: registryRecord.content_hash,
          generating_id: registryRecord.generating_id,
          created_at: registryRecord.created_at
        }
      };
    }
    return {
      status: 'anchor_only',
      anchor_layer: anchorLayerStatus,
      anchor_fields: anchorFields
    };
  }

In the final verified return object add:
  anchor_layer: anchorLayerStatus,

In the certificate verification block after signatureValid
is confirmed, add certificate pinning:
  if (!sessionCertFingerprint) {
    sessionCertFingerprint = signedManifest.cert_fingerprint;
  } else if (sessionCertFingerprint !==
             signedManifest.cert_fingerprint) {
    return {
      status: 'injection_detected',
      session_cert_fingerprint: sessionCertFingerprint,
      injected_cert_fingerprint: signedManifest.cert_fingerprint,
      signed_at: signedManifest.signed_at ?? null
    };
  }

In the failed state for text hash mismatch — replace the
existing original_manifest return with:
  // Only return original_manifest if text length within 10%
  const originalLength = signedManifest.manifest.text_hash
    ? extracted.cleanText.length : 0;
  const receivedLength = embeddedText.length;
  const lengthDelta = Math.abs(originalLength - receivedLength)
    / Math.max(originalLength, 1);
  if (lengthDelta <= 0.10) {
    return {
      status: 'failed',
      reason: 'Visible text modified after signing',
      anchor_layer: anchorLayerStatus,
      original_manifest: { /* existing fields unchanged */ }
    };
  } else {
    return {
      status: 'failed',
      reason: 'content_mismatch',
      anchor_layer: anchorLayerStatus
    };
  }

═══════════════════════════════════════════
FILE 6 — MODIFY compression.mjs
═══════════════════════════════════════════

These are the only changes. Do not touch anything else.

In FIELD_MAP add:
  confidence_source: 'csrc',
  anchor_hmac: 'ah'

In compress() inside the segment entry block add:
  if (seg.confidence_source)
    entry[FIELD_MAP.confidence_source] = seg.confidence_source;

In decompress() inside the segment entry block add:
  if (seg[FIELD_MAP.confidence_source])
    entry.confidence_source = seg[FIELD_MAP.confidence_source];

In compress() for the outer signed manifest — add handling
for anchor objects. Anchor objects are smaller than full
manifests and only carry the six anchor fields. Add a separate
export function compressAnchor(anchorObject) that maps only
the six anchor fields using FIELD_MAP and returns the
compressed anchor object. Add export function
decompressAnchor(compressed) as the reverse.

═══════════════════════════════════════════
FILE 7 — MODIFY registryClient.mjs
═══════════════════════════════════════════

These are the only changes. Do not touch anything else.

In registerContent() add validation before the insert:

  // Validate content hash format
  if (!/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new Error('Invalid content hash format —' +
      ' must be 64 lowercase hex characters');
  }

  // Validate generating ID format
  if (!/^[a-z0-9-]+-v[0-9]+\.[0-9]+$/.test(generatingId)) {
    throw new Error('Invalid generating ID format —' +
      ' must match pattern tool-name-vX.Y');
  }

═══════════════════════════════════════════
FILE 8 — CREATE testRedundantEmbedding.mjs
═══════════════════════════════════════════

Location: project root.

Import: generateManifest from manifestGenerator.mjs
Import: signManifest from signingLayer.mjs
Import: embedManifest from embeddingLayer.mjs
Import: verifyManifest from verificationTool.mjs

const visibleText = [
  'First paragraph. This was written by a human author.',
  'Second paragraph. This section was generated by AI.',
  'Third paragraph. This section was modified by AI.',
  'Fourth paragraph. Final human written conclusion here.'
].join('\n\n');

// Detect paragraph boundaries
const paragraphBoundaries = [];
let pos = 0;
for (const line of visibleText.split('\n\n')) {
  paragraphBoundaries.push(pos);
  pos += line.length + 2;
}

const manifest = generateManifest({
  visibleText,
  segments: [
    { segmentId: 's001', startOffset: 0,
      endOffset: 51, origin: 'human', confidence: 95 },
    { segmentId: 's002', startOffset: 53,
      endOffset: 104, origin: 'ai_generated',
      aiTool: 'claude-sonnet-4', confidence: 98 },
    { segmentId: 's003', startOffset: 106,
      endOffset: 157, origin: 'ai_modified_human',
      aiTool: 'claude-sonnet-4',
      modificationDegree: 0.4, confidence: 87 },
    { segmentId: 's004', startOffset: 159,
      endOffset: visibleText.length - 1,
      origin: 'human', confidence: 92 }
  ],
  signingTool: 'lps-reference-implementation-v0.1',
  signedAt: new Date().toISOString()
});

const signedManifest = signManifest(manifest);
const embeddedText = embedManifest(visibleText,
  signedManifest, paragraphBoundaries);

console.log('--- TEST 1: verified state ---');
const result = await verifyManifest(embeddedText);
console.log('Status:', result.status);
console.log('Anchor layer:', result.anchor_layer);
console.log('Expected: verified, present');

console.log('\n--- TEST 2: anchor_only state ---');
// Simulate signal stripped — plain text only
const strippedText = visibleText;
const anchorOnly = await verifyManifest(strippedText);
console.log('Status:', anchorOnly.status);
console.log('Expected: anchor_only or registry_required');

console.log('\n--- TEST 3: tampered text ---');
const tampered = embeddedText + ' TAMPERED';
const tamperedResult = await verifyManifest(tampered);
console.log('Status:', tamperedResult.status);
console.log('Expected: failed');

console.log('\n--- TEST 4: anchor layer absent on verified ---');
// Embed without paragraph boundaries — no anchors
const noAnchorText = embedManifest(visibleText, signedManifest);
const noAnchorResult = await verifyManifest(noAnchorText);
console.log('Status:', noAnchorResult.status);
console.log('Anchor layer:', noAnchorResult.anchor_layer);
console.log('Expected: verified, absent');

═══════════════════════════════════════════
SECURITY CONSTRAINTS — MANDATORY
═══════════════════════════════════════════

These apply to every line of code you write:

- Never read private.pem in any file except signingLayer.mjs
  and anchorLayer.mjs. anchorLayer.mjs reads it only to derive
  the HMAC key. The key bytes never appear in logs or errors.

- All HMAC comparisons must use crypto.timingSafeEqual().
  Never use === or == for comparing cryptographic values.

- Magic prefix secondary validation is mandatory in parseHeader().
  Type must be 0 or 1. Version must be 1. Total must be > 0.
  Buffers failing secondary checks are discarded silently.

- Never modify visible characters during embedding.
  The clean text extracted by verificationTool.mjs must be
  character-for-character identical to the original visibleText.

- Every function that reads from disk wraps the read in
  try/catch and throws a generic message. Never leak file
  paths or system errors in thrown messages.

- No console.log inside production files. Only test files
  use console.log.

- Every new export must be independently testable.
  No function depends on global mutable state.

═══════════════════════════════════════════
OUTPUT EXPECTED
═══════════════════════════════════════════

After running this prompt Claude Code must have produced:

New files:
  chunkLayer.mjs
  anchorLayer.mjs
  paragraphAnalysis.mjs
  testRedundantEmbedding.mjs

Modified files:
  embeddingLayer.mjs — new signature, PROPOSAL 005 path added,
    existing A.8/A.9 path unchanged and backwards compatible
  verificationTool.mjs — classification, anchor validation,
    reconstruction, new status states, certificate pinning,
    anchor_layer field on all return objects
  compression.mjs — csrc and ah shortcodes added,
    compressAnchor and decompressAnchor exported
  registryClient.mjs — input validation on registerContent()

Unchanged files:
  manifestGenerator.mjs
  signingLayer.mjs
  confidenceFallback.mjs
  registryClient.mjs queryRegistry() — unchanged
  All existing test files — unchanged and still passing

Run existing tests after implementation to confirm no
regressions. Then run testRedundantEmbedding.mjs.