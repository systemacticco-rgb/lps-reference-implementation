# CHANGELOG.md

This changelog records architectural, security, and documentation changes for the LPS reference implementation. It is not a Git commit log. It is a human-readable record of why the system changed.

## 2026-07-04 (7:31pm) — Disclosure-threshold call-site defect fixed

- Found: the disclose-branch in `verificationTool.mjs` STEP 4 contained
  a dead duplicate of `evaluateDisclosureThreshold()`'s decision logic —
  a second `lengthDelta`/`withinThreshold` computation using
  `receivedLength`/`signedLength`, names that were never declared in
  that scope (they exist only as parameter names inside
  `evaluateDisclosureThreshold()`).
- Impact: any real small-edit input (delta within the 10% threshold)
  reaching that branch would have thrown an unhandled `ReferenceError`
  instead of returning `failed` with `original_manifest` disclosed.
  This was the exact small-edit path the 2026-07-03 (11:18pm) refactor
  below was meant to make testable — the pure function was tested and
  correct; the call site consuming its result was not.
- Cause: leftover from the extraction below. When the inline logic was
  pulled into `evaluateDisclosureThreshold()`, the original inline copy
  should have been deleted from the STEP 4 call site and was not.
- Fix: removed the dead duplicate entirely. The call site now returns
  directly on `evaluateDisclosureThreshold()`'s `disclose: true` result
  with no recomputation. One source of truth for this decision.
- Tests: two new pipeline-level cases added to `testVerification.mjs`,
  both run through the real `generateManifest → signManifest →
  embedManifest → verifyManifest` pipeline, not the isolated pure-
  function calls:
  - small-edit (2% length delta): `failed` status, `original_manifest`
    disclosed. Confirmed passing in the real environment.
  - extreme-mismatch (18% length delta): `failed` status,
    `original_manifest` withheld. Confirmed passing in the real
    environment — this case previously only logged output with no
    assertion; it now asserts explicitly.
- The 2026-07-03 (11:18pm) entry below is scoped correctly for the pure
  function it describes. Its "verified passing in the real
  implementation environment" claim did not extend to this call site,
  which is why this entry exists separately rather than editing that
  one.

## 2026-07-03 (11:18pm) — Disclosure-threshold testability refactor
- Extracted the D.6 length-mismatch disclosure decision out of
  `verifyManifest()`'s inline STEP 4 logic into a standalone exported
  function, `evaluateDisclosureThreshold()`, in `verificationTool.mjs`.
- Reason: the inline version could not be unit-tested directly — no
  real pipeline input produces a manifest missing `text_length`, so
  that edge case was untestable without this extraction.
- Added 8 direct unit test cases to `testVerification.mjs`: missing
  `text_length` (undefined and null), within-threshold (5% delta),
  the exact 10% boundary (inclusive, both sides), exceeds-threshold
  (20% delta and just-over-boundary), and zero-length signed text
  (exact match and any mismatch).
- Verified passing in the real implementation environment. Full
  pipeline regression reconfirmed: `verified` state on clean text,
  and the existing adversarial tampered-text test correctly withholds
  `original_manifest` under the threshold logic.
- No behavior change — pure structural extraction, verified line-by-
  line against the pre-refactor inline logic before being applied.

## 2026-07-03 — D.1–D.7 discrepancy audit fixes
- D.1: `content_hash` format validation (64 lowercase hex) and a
  minimal safety-only `generating_id` check (printable ASCII, 1–128
  chars) implemented in `registryClient.mjs` ahead of the Supabase
  insert. The `generating_id` structural schema question (opaque
  token vs. structured identifier) was explicitly left open and
  deferred to working-group input — see SPEC.md §9.
- D.2: `compression.mjs`'s `compress()` now omits `lv`/`st` when they
  match v0.1 defaults; `decompress()` fills defaults on absence.
  Brings code in line with what README §3.2 and SPEC §4.1 already
  claimed.
- D.3: `anchor_hmac` shortcode deliberately not added to SPEC §4.1's
  dictionary — belongs to PROPOSAL 005, whose key hierarchy is still
  undecided. Revisit once that decision locks.
- D.4/D.8: `confidence_source` added to all three example segments in
  README §3.2; `ai_tool` added to the `s002` example (missing despite
  the code always producing it). Defining sentence added for all
  three `confidence_source` values, noting `derived` is schema-
  defined but not currently emitted.
- D.5: `anchor_hmac` removed entirely from `compression.mjs` — the
  `FIELD_MAP` entry and both `compress()`/`decompress()` read/write
  lines. Field was never populated by `manifestGenerator.mjs`; no
  document claimed it was implemented, so removal created no new
  discrepancy.
- D.6: `text_length` field added to the manifest schema
  (`visibleText.length`, always present, no default-omission).
  Protected by the same signature covering the rest of the manifest.
  `original_manifest` disclosure in the `failed` state now gated by a
  10% length-mismatch threshold in `verificationTool.mjs` STEP 4.
  Shortcode `tl` added to `compression.mjs`. README §3.2 and SPEC
  §4.1 updated. "Transfer/replay" threat model entry upgraded from
  PARTIALLY DEFENDED to DEFENDED.
- D.7: SPEC §6's `generating_id` pattern text corrected to match the
  safety-only implementation, with an explicit statement that the
  structural schema question is open and deferred.
- Not resolved this session: rate limiting on `registerContent()`.
  Correct approach confirmed as a Supabase-backed count query
  (in-memory rejected — Vercel serverless functions do not share
  memory across invocations). Sequencing pending confirmation of the
  actual Supabase table schema.

## 2026-07-03 — Documentation structure added

- Added `ARCHITECTURE.md` as the high-level system map.
- Added `DIAGRAMS.md` to show component flow, trust boundaries, verification flow, and future Proposal 005 structure.
- Added `IMPLEMENTATION_STATUS.md` to separate built, defined, planned, and placeholder work.
- Added `SECURITY_MODEL.md` to capture the system threat model, trust assumptions, invariants, and non-goals.
- Established a clearer documentation hierarchy:
  - README.md = what the project is
  - ARCHITECTURE.md = how the system fits together
  - SPEC.md = precise implementation specification
  - DIAGRAMS.md = visual map
  - IMPLEMENTATION_STATUS.md = build status
  - SECURITY_MODEL.md = security posture

## 2026-06-30 — ES256 signature encoding correction

- Corrected manifest signing and verification to use `dsaEncoding: 'ieee-p1363'`.
- Closed the mismatch between the `es256` label and Node's default DER signature output.
- Confirmed internal round-trip verification passes.
- Confirmed an independent cross-check with the panva/jose library passes at the primitive level.
- Clarified that LPS still does not emit a JOSE or COSE envelope in v0.1.
- Marked envelope-level interoperability as future work.

## 2026-06-21 — Registry stub added

- Added a registry stub backed by Supabase.
- Implemented registration and lookup by token and content hash.
- Added registry verification behavior for the `registry_required` state.
- Introduced usage-event logging for registry queries.
- Kept the production registry architecture separate from the v0.1 stub.

## 2026-06-20 — Compression and capacity work

- Measured manifest size against the Unicode variation selector capacity ceiling.
- Added shortcode compression as a core v0.1 size reduction step.
- Documented the move toward CBOR encoding as a later optimization.
- Established the 220-byte trigger threshold for fallback embedding behavior.
- Separated the current A.8 embedding path from the future A.9 / redundant-embedding path.

## 2026-06-19 — Core pipeline completed

- Completed the four main v0.1 components:
  - manifest generation
  - signing
  - embedding
  - verification
- Added the confidence fallback mechanism.
- Added the initial test suite for the baseline pipeline.
- Established the built verification states:
  - verified
  - failed
  - degraded
  - registry_required

## 2026-06 — Proposal and research foundation

- Defined LPS as a span-level AI contribution provenance schema for C2PA-compatible text workflows.
- Identified the gap between binary AI involvement claims and granular contribution tracking.
- Separated built v0.1 behavior from future Proposal 005 work.
- Documented future verification states for redundant embedding and cross-copy reconstruction:
  - anchor_only
  - partial_recovery
  - injection_detected
  - reconstruction_corrupted

  ## 2026-07-05 — SIGNING_ENABLED killswitch implemented

- Found: SPEC §3 specified a SIGNING_ENABLED environment-variable
  check as a global constraint on signManifest() — "checked first...
  before any key access" — but no code implemented it. Confirmed via
  full-repo grep: zero references outside SPEC.md itself.
- Decision: implement as a genuine operational killswitch, not
  decorative. Distinct from key-existence handling (the existing
  try/catch around private.pem, unchanged) — this gates whether
  signing is permitted to run at all, independent of whether the
  key file resolves.
- Fix: guard clause added as the first statement in signManifest(),
  throwing before either readFileSync call if SIGNING_ENABLED !== 'true'.
- SPEC §3 line retagged [BUILT — 2026-07-05], closing the tagging
  gap where an unmarked invariant sat in a SECURITY-CRITICAL section
  with no enforcement.
- Not yet done: no test file covers this path. testSigning.mjs should
  gain a case confirming signManifest() throws when SIGNING_ENABLED
  is unset or false, and succeeds when set to 'true'.

## Change-log rule

If a feature is not explicitly marked as built, treat it as specified or planned rather than implemented.
