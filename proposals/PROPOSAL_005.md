## PROPOSAL 005 — LPS redundant invisible chunk carrier
and Cross-Copy Reconstruction

Status: proposed — post-v0.1

═══════════════════════════════════════════
PROBLEM
═══════════════════════════════════════════

A.8R distributes one logical manifest as dependent sequential invisible chunks. Partial copy by the user destroys the payload if any required chunk is missing. No reconstruction is possible from partial chunks alone. A single copy embedded once has a single point of failure. This is proposed future work, not a built carrier.

═══════════════════════════════════════════
ARCHITECTURE — TWO LAYERS
═══════════════════════════════════════════

Layer 1 — Anchor Manifest
Layer 2 — Overlapping Redundant Full Manifest Copies
This architecture is conceptual only. It describes the intended direction of future work. The carrier format, arbitrary-position embedding capability, reconstruction contract, and validation rules have not yet been finalized or implemented.

═══════════════════════════════════════════
LAYER 1 — ANCHOR MANIFEST
═══════════════════════════════════════════

A minimal manifest embedded at the start of every paragraph.
Contains document-level fields only:

  text_hash
  overall_ai_proportion
  human_proportion
  algorithm
  signed_at

No segment array. No signature. No cert.
Designed to remain well within the conservative A.8 payload range used by the current reference implementation. There is no protocol-defined A.8 size ceiling; larger invisible payloads primarily reduce editor-survival probability rather than violating the protocol itself.
Segment array is the primary size driver — its absence
keeps the anchor small regardless of document complexity.

Purpose:
- Survive short copies where no full copy is recoverable
- Confirm expected chunk total and text_hash for reconstruction
  validation
- Provide forensic document-level picture when all full copies
  are lost

Embedded using A.8 — one block per paragraph start character.
Number of anchors = number of paragraphs in document.

═══════════════════════════════════════════
LAYER 2 — OVERLAPPING REDUNDANT FULL MANIFEST COPIES
═══════════════════════════════════════════

Multiple complete copies of the full signed manifest embedded 
using a proposed A.8R redundant invisible chunk carrier. The exact carrier grammar, embedding mechanism, extraction rules, and reconstruction semantics remain under design and are not part of the current implementation.
Each copy is independently extractable. Copies overlap 
intentionally to eliminate boundary
vulnerabilities and enable cross-copy reconstruction.

Number of copies:
One complete copy per paragraph. Scales automatically with
document length. A ten paragraph document carries ten copies.

Overlap model — fixed at 25%:
Each copy overlaps the previous copy by 25% of its chunk range.
This is the defined spec value — not calculated dynamically.

Example — 120 chunk manifest, four paragraph document:
  Copy A: chunks 001–040  (paragraphs 1 characters)
  Copy B: chunks 031–070  (paragraph 2 characters)
  Copy C: chunks 061–100  (paragraph 3 characters)
  Copy D: chunks 091–120  (paragraph 4 characters)

Overlap zones:
  Copy A / Copy B overlap: chunks 031–040
  Copy B / Copy C overlap: chunks 061–070
  Copy C / Copy D overlap: chunks 091–100

Every chunk in the overlap zone exists in two independent copies
attached to different visible characters in different paragraphs.
Deleting one paragraph cannot destroy both copies of any
overlapping chunk.

═══════════════════════════════════════════
CHUNK STRUCTURE
═══════════════════════════════════════════

The following structure is a proposed grammar, not a finalized wire format. Header fields, serialization, and validation behavior remain subject to implementation review and working-group feedback.

Every A.8R chunk carries a four-field positional header
prepended before the payload bytes:

  seq      uint16  — position of this chunk in the full sequence
  total    uint16  — total chunks in the full sequence
  copy_id  uint8   — which copy this chunk belongs to (A=1, B=2...)
  version  uint8   — header format version, fixed at 1 for v0.1

Header size: 6 bytes per chunk.
Payload bytes follow immediately after the header.
Total chunk size: 6 + payload_slice_size bytes.

The seq number is the universal identifier. Two chunks with
the same seq number from different copy_ids carry identical
payload bytes. The verifier treats them as interchangeable.

═══════════════════════════════════════════
RECONSTRUCTION LOGIC
═══════════════════════════════════════════

This reconstruction algorithm is illustrative. Final behavior depends on the carrier format ultimately adopted for A.8R.
s
Step 1 — Collection
Extract all chunks from all positions in received text.
Group by seq number across all copy_ids.
For each seq position, record all surviving chunks found.

Step 2 — Deduplication
For each seq position, take the first surviving chunk found.
All chunks at the same seq position are identical — any one
is sufficient. copy_id is irrelevant for payload content.

Step 3 — Gap detection
Identify missing seq positions — positions where no chunk
survived in any copy.

Step 4 — Overlap resolution
Overlap zones are known from the fixed 25% model.
For seq positions in overlap zones, check both copies.
If one copy lost the chunk, the other copy's chunk is used.
No special logic required — deduplication in Step 2 handles
this automatically via seq number grouping.

Step 5 — Reassembly decision
If all seq positions 001–total are filled:
  Reassemble payload, decode CBOR, decompress, verify signature.
  Return verified or failed based on signature and text hash.

If majority of seq positions filled but gaps remain:
  Return partial_recovery status.
  Report which seq positions are missing.
  Return all fields that could be reconstructed.
  Note that signature verification cannot run on partial payload.

If no chunks found anywhere:
  Check anchor manifests.
  If anchors present — return anchor_only status.
  If no anchors — check registry.
  If registry empty — return degraded.

═══════════════════════════════════════════
VERIFICATION STATUS — NEW STATES
═══════════════════════════════════════════

anchor_only
  No full manifest copy recoverable.
  Anchor manifests present and consistent.
  Returns: text_hash, overall_ai_proportion, human_proportion,
  algorithm, signed_at.
  Does not return segment breakdown.
  Does not run signature verification.
  Forensic value: document-level provenance confirmed.
  Segment-level detail unavailable.

partial_recovery
  Full manifest partially reconstructed from surviving chunks
  across multiple copies. Not all seq positions filled.
  Returns: only fields that can be reconstructed deterministically, list of missing seq positions, and a note that signature verification did not run. No field should be returned unless its correctness can be established independently from the missing data.

═══════════════════════════════════════════
SURVIVAL SCENARIOS
═══════════════════════════════════════════

User copies one full paragraph:
  One complete copy recovered. Full verification runs.
  Status: verified or failed.

User copies portion of one paragraph:
  No full copy. Overlap chunks from adjacent copies may be
  present if copied portion included paragraph boundary.
  Cross-copy reconstruction attempted.
  Status: partial_recovery or anchor_only.

User accidentally deletes a sentence mid-paragraph:
  All copies lose chunks attached to deleted characters.
  Overlap zones in adjacent paragraphs fill those gaps.
  If gaps filled — full reconstruction succeeds.
  Anchor text_hash will not match modified text — tamper
  detected at anchor level before reconstruction completes.
  Status: failed with original document-level fields from anchor.

Platform strips all non-standard Unicode:
  All layers lost. Registry fallback only.
  Status: registry_required or degraded.

Adversarial targeted removal:
  Requires extraction tool to identify chunk positions.
  Overlap zones mean each seq position must be removed from
  two different paragraph locations to truly destroy it.
  Labor cost scales with number of paragraphs.
  Status after partial removal: partial_recovery exposes
  the attempt — missing seq positions are reported explicitly.

═══════════════════════════════════════════
CONSTRAINTS — UPDATED WITH COUNTERS
═══════════════════════════════════════════

HMAC key derivation:
  HMAC key material is derived using Node's built-in
  crypto.hkdfSync('sha256', ikm, salt, info, 32).

  HKDF-SHA256 is the confirmed primitive, replacing an earlier
  createSign-based draft. Chosen for reviewer familiarity and
  zero added dependencies.

  ikm, salt, and info are NOT YET DEFINED. They are locked
  together as one decision — see [D.15] — which must specify
  the root keying material, whether anchor keys derive from
  the signing key or a separate master secret, and how future
  keys (registry, token, rotation) extend the hierarchy without
  rework.

  Once [D.15] locks, this section is rewritten once with final
  values and treated as immutable — same rule as the shortcode
  dictionary. See [D.17].

Derived key is sensitive — never logged, never returned
  in error messages, never stored. Same rules as private key.
  Must be stated explicitly in Section 7 security constraints.

Paragraph merge decisions:
  paragraphAnalysis() must return all merge decisions explicitly
  in the plan output as merged_paragraphs: [2, 3] per zone entry.
  Merges are never silent. verificationTool.mjs surfaces merge
  map in verified output so forensic report reflects actual
  embedding zones not original paragraph structure.

Chunk 001 special case:
  Chunk 001 payload is 40 bytes — 32 checksum + 8 data.
  All other chunks carry 8 bytes payload.
  Slicing function in embeddingLayer.mjs treats chunk 001
  separately. parseHeader() in chunkLayer.mjs is unaffected —
  it strips the 11-byte header and returns whatever follows.
  reconstructFromChunks() knows chunk 001 payload starts
  with 32 checksum bytes before data bytes begin.

Replay attack — original_manifest disclosure threshold:
  failed state returns original_manifest only when received
  text length is within 10% of original text length.
  Extreme mismatch returns only signed_at, algorithm, and
  content_mismatch reason. Full disclosure reserved for
  minor edits where forensic value outweighs disclosure risk.
  Threshold locked at 10% — see [D.6]. Implemented in
  verificationTool.mjs, confirmed passing in the real
  environment (small-edit discloses, extreme-mismatch
  withholds). Open question for this proposal specifically:
  whether partial_recovery needs its own disclosure rule,
  since reconstruction may only recover a fraction of the
  signed text length rather than receiving a full substitute
  text to compare against.

Manifest injection via copy_id exhaustion:
  Verifier pins expected certificate on first successful
  chunk assembly that passes signature verification.
  cert_url and cert_fingerprint from that assembly become
  the session anchor for all subsequent assemblies.
  Any subsequent assembly producing a different cert_url
  or cert_fingerprint is flagged as injection_detected.
  Forensic output records both certificate fingerprints.

Anchor substitution and stripping:
  verified state carries anchor_layer field at all times.
  Values: present | absent | conflict.
  Absence of anchors when full manifest verified is
  forensically significant and must be surfaced explicitly.
  Forged anchors with invalid HMAC are discarded silently.
  anchor_layer: conflict returned when valid anchors
  disagree on text_hash — recorded with all unique
  text_hash values found.

HMAC timing safety:
  All HMAC comparisons must use crypto.timingSafeEqual().
  Never standard equality. Applies to verifyAnchorHMAC()
  and any other HMAC comparison in the codebase.
  Stated as global constraint in Section 7.

Magic prefix secondary validation:
  After magic prefix match, validate:
    type field is exactly 0 or 1
    version field is exactly 1
    total field is greater than 0
  Buffers failing secondary checks discarded immediately.
  No further parsing on failed secondary check.
  Injection volume cap: discard buffers beyond
  paragraphCount × totalChunks × 3 per document.
  Flag as injection_volume_exceeded if cap reached.
  Cap formula open — see Section 9.

Registry poisoning defence:
  content_hash validated as exactly 64 lowercase hex
  characters before insert. Reject anything else.
  generating_id currently enforces a safety-only check only
  (printable ASCII, 1-128 chars) per [D.1] — the structural
  format shown below is a candidate direction, not yet
  adopted, and was explicitly deferred to working-group
  input:
    candidate pattern: [a-z0-9-]+-v[0-9]+\.[0-9]+
    Format definition open — see Section 9.
  Rate limit: maximum registrations per generating_id
  per hour before insert is rejected. created_at exists on
  registry_records, making a Supabase COUNT-based rate limit
  viable. Threshold open — see Section 9. All three controls
  applied in registerContent() before Supabase insert runs.

Partial recovery forensic misrepresentation:
  partial_recovery output must include:
    reconstruction_completeness — percentage of seq
    positions successfully filled.
    low_confidence_reconstruction: true when completeness
    below 50%.
    Segment array explicitly labeled as partial.
    expected_segment_count from anchor manifest always
    present alongside any returned segment array so reader
    knows immediately how many segments are missing.
  Verifier never returns segment array in partial_recovery
  without expected_segment_count.

Anchor manifest not cryptographically signed in v0.1:
  HMAC provides integrity protection but is not a full
  signature. Independent verification of anchor without
  the full manifest is not possible in v0.1.
  Full anchor signing deferred to v0.2.

Total payload profiling required before implementation:
  number of copies × manifest size × chunk header overhead
  must be validated against minimum expected document length
  before build begins.

Canonicalization determinism across reconstruction:
  reconstructFromChunks() re-derives canonical bytes from
  recovered fragments before signature verification can run.
  This requires the verifier to know which CBOR encoder
  version produced those bytes. Tagging fragments or the
  anchor manifest with an encoder-version field creates a
  circular trust problem — the verifier cannot select the
  correct encoder without first trusting a field it has not
  yet verified. No resolution adopted. Must be decided before
  chunkLayer.mjs or reconstructFromChunks() implementation
  begins — see SECURITY_MODEL.md "Security assumptions."
  Threshold/approach open — see Section 9.

Reconstruction logic requires verificationTool.mjs update.
Chunk header format requires embeddingLayer.mjs update.
c2pa-text chunk header exposure — see appendix gap 1.
Position parameter confirmation — see appendix gap 2.
Fixed 25% overlap is the spec value for v0.1.
  Not configurable at runtime.

═══════════════════════════════════════════
CONNECTS TO
═══════════════════════════════════════════

PROPOSAL 001 — Notarization Registry
Section 4 — Embedding Layer
Section 4.1 — Compression — chunk header not yet in shortcode
              dictionary, not applicable — header is pre-compression
Section 8 — outstanding test gap: A.9 path not yet tested
Section 9 — open question: multi-round provenance shares
            chunk architecture decisions made here
            