embeddingLayer.mjs — changes required

  embedManifest(visibleText, signedManifest, paragraphBoundaries):

  Step 1 — Validate paragraph boundaries against visible text.
  Remove invalid boundaries. Fall back to 500-character splits
  if no valid boundaries found.

  Step 2 — Compress and encode signed manifest to binary buffer.
  Compute SHA-256 of full buffer. Store hash in payload of
  chunk 001 as extended payload prefix — 32 extra bytes on
  chunk 001 only.

  Step 3 — Slice buffer into 8-byte payload chunks.
  Prepend 11-byte header to each chunk using chunkLayer.mjs.
  Total chunks = ceil(buffer.length / 8).

  Step 4 — Run paragraphAnalysis() to produce copy distribution
  plan with 25% overlap. Handles short paragraphs by merging
  embedding zones. Returns validated plan before any embedding.

  Step 5 — For each paragraph in distribution plan:
    Call anchorLayer.buildAnchor() — extract document-level
    fields, compute HMAC using HKDF-derived key from private key.
    Call anchorLayer.embedAnchor() — compress, prepend header
    with type=0, embed via A.8 at paragraph start character.
    Embed assigned chunk range via A.9 across paragraph
    characters using chunkLayer chunk buffers.

  Step 6 — Return embedded text. Never modify visible characters.


verificationTool.mjs — changes required

  verifyManifest(embeddedText):

  Step 1 — Extract all invisible buffers from text.
  For each buffer, check magic prefix 0x4C505301.
  Discard any buffer missing magic prefix silently.
  Call chunkLayer.parseHeader() on remaining buffers.
  Separate type=0 (anchors) from type=1 (chunks).
  If parseHeader() returns version_mismatch — log and discard.

  Step 2 — Validate anchors.
  For each anchor buffer, verify HMAC using public certificate
  derived key. Discard anchors with invalid HMAC.
  Among valid anchors confirm all text_hash values agree.
  If conflict — return anchor_conflict with all unique
  text_hash values found.
  Store validated anchor fields for fallback use.

  Step 3 — Reconstruct full manifest.
  Call reconstructFromChunks(chunks):
    Group chunks by seq number across all copy_ids.
    For each seq position where chunks disagree:
      Attempt full reassembly with each candidate.
      Run signature check on each result.
      Take candidate that produces valid signature.
      If neither valid — mark seq position as lost.
    For each seq position where chunks agree:
      Take that chunk. No conflict resolution needed.
    Detect gaps — seq positions with no surviving chunk.
    If no gaps:
      Assemble buffer. Recompute SHA-256. Compare against
      value stored in chunk 001 extended payload.
      If checksum mismatch — return reconstruction_corrupted.
      Attempt with next candidate chunks.
      If checksum match — proceed to CBOR decode.
    If gaps present:
      Return partial_recovery with gap map and all
      successfully reconstructed fields.

  Step 4 — CBOR decode and decompress reconstructed buffer.
  If decode throws — return degraded with corrupted signal note.

  Step 5 — Certificate fetch, fingerprint check, signature
  verification. Unchanged from current implementation.

  Step 6 — Text hash check against anchor text_hash and
  against manifest text_hash. Both must agree.
  If anchor text_hash differs from manifest text_hash —
  report anchor_manifest_conflict. Forensically significant.

  Step 7 — Return verified with full breakdown, or failed
  with reason and original manifest fields.

  Fallback chain if reconstruction produces nothing:
    anchor_only — valid anchors found, no chunks recovered.
    registry_required — no anchors, registry has record.
    degraded — nothing found anywhere.


chunkLayer.mjs — new file

  Magic prefix: Buffer.from([0x4C, 0x50, 0x53, 0x01])
  Header total: 11 bytes (4 magic + 2 seq + 2 total +
                          1 copy_id + 1 version + 1 type)

  prependHeader(buffer, seq, total, copy_id, type):
    Validates: seq <= total, copy_id >= 1, type in [0,1].
    Throws on invalid input. Never silently accepts bad values.
    Builds header buffer. Returns Buffer.concat([magic,
    header, buffer]).

  parseHeader(buffer):
    Checks buffer length >= 11. Returns null if shorter.
    Checks magic prefix matches exactly.
    Returns null if magic mismatch — not an LPS buffer.
    Reads header fields.
    If version !== 1 — returns { version_mismatch: true,
    found_version: version }. Does not throw.
    Returns { seq, total, copy_id, version, type, payload }
    where payload is buffer.slice(11).


anchorLayer.mjs — new file

  buildAnchor(signedManifest, privateKeyPath):
    Extracts: text_hash, overall_ai_proportion,
    human_proportion, algorithm, signed_at.
    Derives HMAC key using HKDF from private key material.
    HKDF info string: 'lps-anchor-hmac-v0.1'
    Computes HMAC-SHA256 of anchor fields JSON.
    Returns anchor object with all five fields plus hmac field.

  embedAnchor(anchorObject, text, position):
    Compresses anchor object using compress() from
    compression.mjs.
    Calls chunkLayer.prependHeader() with type=0, seq=0,
    total=1, copy_id=0.
    Embeds via A.8 at specified character position.
    Returns modified text.

  verifyAnchorHMAC(anchorObject, publicCertificate):
    Derives verification key from public certificate
    using same HKDF parameters.
    Recomputes HMAC over anchor fields.
    Returns true if match, false if mismatch.
    Never throws — returns false on any error.


paragraphAnalysis.mjs — new file

  paragraphAnalysis(visibleText, paragraphBoundaries,
                    totalChunks):

    Step 1 — Validate each boundary. A boundary is valid
    if visibleText[boundary] is first non-whitespace after
    a newline. Remove invalid boundaries.

    Step 2 — If no valid boundaries found, generate
    synthetic boundaries at every 500 characters.

    Step 3 — Calculate characters available per paragraph.

    Step 4 — Calculate chunks per paragraph needed.
    Formula: ceil(totalChunks / paragraphCount) × 1.25
    The 1.25 factor accounts for 25% overlap.

    Step 5 — Check minimum viable threshold.
    Each paragraph needs at least:
    chunksAssigned × 2 visible characters.
    (Each chunk attaches to minimum 2 characters to avoid
    concentration at single characters.)
    If paragraph too short — merge with next paragraph.
    Repeat until all zones meet minimum threshold.

    Step 6 — Assign chunk ranges with 25% overlap.
    Each copy starts 75% of the way through previous copy.
    copy_start_chunk = prev_copy_start + floor(prev_range × 0.75)
    Clamp final copy end to totalChunks.

    Step 7 — Return copyDistributionPlan[]:
    Each entry: { copy_id, start_chunk, end_chunk,
                  char_start, char_end, paragraph_ids[] }

    Step 8 — If entire document too short for even one copy:
    Return minimum viable plan — one copy across full document,
    no overlap, anchors at valid boundaries only.
    Flag: minimum_viable_plan: true.
    verificationTool.mjs surfaces this flag in output.


compression.mjs — minor addition only

  Add to FIELD_MAP:
    confidence_source: 'csrc'
    anchor_hmac: 'ah'

  Handle both fields in compress() and decompress()
  inside segment entries and anchor objects respectively.
  No structural changes.