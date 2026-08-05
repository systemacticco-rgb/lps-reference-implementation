# CHANGELOG.md

This changelog records architectural, security, and documentation changes for the LPS reference implementation. It is not a Git commit log. It is a human-readable record of why the system changed.

## [2026-08-03] — Proposal 007 traceability added

- Added documentation traceability for the separate Proposal 007 testing tool:
  a **proposed** AI-only marker/header design record; a
  **recorded** route-scoped cross-transport evidence log. Neither changes the
  audited LPS `ev: 1` envelope, selector carrier, registry, cryptographic, or
  production-trust contract.
- Recorded the boundary that a document-scoped total-count header offers
  count-level observation only; human spans and per-span ordinals/counts are
  excluded, so ordinal-gap localization and the former human-marker
  selective-stripping signal are unavailable.
- Recorded the interpretation boundary: route-specific marker survival
  describes the received tool input only. The Messenger selection/trailing-U+0020
  observation and Facebook Web composer/post difference do not establish a
  mutation cause, service behavior, provenance, authorship, or portability.
- Kept the later 2026-07-31 local-test evidence separate from the 2026-07-29
  cross-transport record. No source, test-tool, or LPS pipeline code changed.
- Did not reconcile ADR 2's proposed detailed error catalog with later observed
  test-output label formatting; no LPS result identifier is affected by that
  unresolved Proposal 007 catalog question.

## [2026-08-02] — Audited current-state contract and documentation alignment

- Recorded the audited `ev: 1` outer-envelope contract, distinct authenticated
  `content_signed_at` and `signed_at` fields, and canonical text binding from
  trailing CR/LF/U+0020 stripping through UTF-8 bytes, SHA-256, and byte
  length.
- Recorded pre-routing duplicate-key rejection as
  `invalid_envelope / noncanonical_encoding / present`, with no certificate or
  registry I/O, and preserved the boundary that parseable invalid envelopes do
  not use recovery fallback.
- Clarified registry outcomes: exact match is `registry_required /
  registry_match`; a miss, transport/HTTP failure, and malformed/incomplete
  response are separate degraded outcomes.
- Recorded the completed assertion-backed confidence, signing, and verification
  regression maintenance, including the locked fallback object
  `{ ai_generated: 82, ai_modified_human: 15, human: 1 }`.
- Rewrote the public and internal documentation roles around the audited scope.
  The audit confirms an allowed HTTPS certificate route and read-only registry
  behavior; it does not establish production trust governance, key management,
  registry operations, or deployment approval.

> **Historical record:** Entries below predate the 2026-08-02 audited
> current-state contract. They are retained as dated context and do not
> override the current documentation on `ev`, timestamps, text binding,
> confidence provenance, result routing, certificate boundaries, or
> production exclusions.

## [2026-07-31] — Proposal 007 testing-tool local evidence recorded

Recorded the Proposal 007 testing-tool observations as a separate,
non-production evidence set. This entry does not change the LPS `ev: 1`
envelope, selector-carrier, registry, cryptographic, or result contract.

| Test case | Recorded result | Testing-tool result |
|---|---|---|
| Firefox/Linux hold-and-drag copy/paste | 100% marker survival in the tested flow | Valid |
| Firefox/Linux double-click copy/paste | 100% marker survival; no trailing space observed | Valid |
| Tested BiDi-language content | 100% marker survival despite highlighting glitches | Valid |
| Malformed sequence | Correct rejection | `E-0-0-2: INVALID_TYPE` |
| Duplicate header | Correct rejection at normalized index `5` | `E006: DUPLICATE_HEADER` |
| Orphaned open marker | Correct rejection at normalized index `5` | `E-007: ORPHANED_OPEN` |
| Orphaned close marker | Correct rejection at normalized index `34` | `E-008: ORPHANED_CLOSE` |
| Trailing normalization | Correct behavior; 100% marker survival | Valid |
| Internal codepoints | 100% survival; correctly detected | `E-009: INTERNAL_SIGNAL` |

Documented the observed rendering differences: no glyphs in Linux
LibreOffice; yellow outlined-square glyphs in Linux VS Code code files only;
no glyphs in Linux VS Code Markdown/text files; rectangle glyphs in Windows
VS Code; no glyphs in tested Windows browser flows; and `ƒ{}` in Windows
OneNote. Visual rendering is not a marker-integrity result without verifier
evidence of codepoint loss or mutation.

Also recorded the testing-tool direction: headers are document-scoped, the
embedding tool is required to support different header sizes, Lens 200 remains
undefined and testing-tool-only, human spans/per-span ordinals/per-span total
counts remain excluded, and internal codepoints in valid marker context use
the internal-signal path. Exact error identifiers and normalized indexes remain
unchanged absent an approved error-catalog change.

Open follow-up remains limited to clipboard-layer causality for trailing
spaces, broader browser/platform/application paths, BiDi selection and
codepoint-order effects, versioned glyph-rendering coverage, production marker
grammar and injection controls, provider-compliance architecture, and Lens 200
acceptance criteria. No source or test code was changed by this documentation
record.

Files: `local-files/ADR_4`, `README.md`, `SPEC.md`, `SECURITY_MODEL.md`,
`public-repo/README.md`, `public-repo/working-group-submission.md`,
`CHANGELOG.md`.

## [2026-07-08 9:32pm] — 10kb survival confirmed

Survival testing at 5kb and 10kb manifest sizes confirmed the A.8
carrier survives copy-paste at both sizes across all editors tested
in the July 2026 survival study. Verification succeeds at all tested sizes after manual normalization is applied. Google Docs and Word Browser, which append trailing whitespace on copy-out, are recorded as failed in the raw Appendix C.1 transport matrix — the manual normalization step confirmed the manifest survived intact in both cases. The statement that trailing-whitespace normalization was not implemented is superseded by the 2026-08-02 audited current-state record; this entry remains a dated survival-study observation. Latency appears above approximately 6,000 variation selectors in rich-text editors that process character-level clipboard payloads — Apple Notes on macOS is the confirmed case at 5kb and above — but latency is not carrier corruption. The 10kb profile is a stress-test scenario, not a production operating range.

## [2026-07-08 7:45pm] — strip rule coverage gap noted

The 2026-07-07 trailing whitespace strip rule was derived from
37 runs across 13 editors, all on macOS. Windows Word was not
tested — \r was included as a zero-cost conservative addition
for that case. The strip rule is locked and the implementation
is correct. The empirical basis is macOS-only. A Windows round
is required before the rule can be considered fully validated
across platforms. Windows coverage gap tracked
as a remaining validation item.

## [2026-07-08] — Configured HTTPS certificate route and Appendix A live output

### cert_url — configured HTTPS route locked (DEC-P.1)
main-pipeline/signingLayer.mjs: cert_url changed from file:// + process.cwd()
placeholder to the configured HTTPS URL:
https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem
The file:// path was a local-testing artifact and was never appropriate
as a permanent value. The first full end-to-end pipeline verification under
the configured cert_url confirmed this session: raw.githubusercontent.com
fetch succeeded, DER fingerprint matched, signature validated, text hash
matched. This historical result does not establish production conditions or
certificate-governance readiness.
Files: main-pipeline/signingLayer.mjs

### test/testVerification.mjs — allowLocalCert removed from clean case (DEC-P.2)
allowLocalCert removed from line 57 (J.3 clean verification case).
Clean case now runs against the configured HTTPS cert_url with no local
certificate override. Adversarial and small-edit cases retain
allowLocalCert: true — their purpose is threshold and disclosure
logic, not cert fetching.
Files: test/testVerification.mjs

### working-group-submission.md — Appendix A States 1–3 replaced with live output
States 1, 2, and 3 in Appendix A replaced with live pipeline output
from the 2026-07-08T02:38:14.081Z run. State 4 unchanged.
This is the first Appendix A populated with real verified output through the
configured HTTPS route; it is not production-readiness evidence.
Files: working-group-submission.md (public repo)

## [2026-07-08] — cert sync and DER fingerprint fix

### cert_fingerprint — DER bytes replacing PEM-string hash
main-pipeline/signingLayer.mjs line 75 and main-pipeline/verificationTool.mjs line 140 were
computing cert_fingerprint by hashing the PEM string (certificate
text including headers and line breaks). Replaced with
X509Certificate.raw (DER bytes) on both sides. DER is the binary
certificate content with no text wrapper — identical certificate
content always produces identical DER bytes regardless of how the
PEM file is encoded, stored, or served. PEM-string hashing was
sensitive to line-ending differences between local disk reads and
GitHub fetch responses, which would produce a fingerprint mismatch
on any cert rotation where file encoding varied.
X509Certificate added to crypto import in main-pipeline/verificationTool.mjs.
Already present in main-pipeline/signingLayer.mjs — no import change needed.
Breaking: manifests signed before this commit carry a cert_fingerprint
computed from PEM-string hashing and will not verify against this
code. No migration required — no distributed signed documents exist
at v0.1.
Files: main-pipeline/signingLayer.mjs, main-pipeline/verificationTool.mjs

### lps-certificates repo — stale cert replaced
lps-certificates on GitHub was holding the cert generated Jul 6
05:48:49 UTC. Local cert.pem had been rotated to the 22:55:25 UTC
version during the genpkey key rotation documented in the Jul 6
CHANGELOG entry, but was never pushed to lps-certificates. All
verification attempts against the configured HTTPS cert_url were failing
at the fingerprint check — the fetched cert and the signing cert
were two different certificates with no key relationship. Fixed by
pushing the current local cert.pem to lps-certificates.
No code changes. No schema changes. No test changes.

## 2026-07-07 — Trailing whitespace normalization and A.9 removal

### Strip rule
Applied /[\r\n ]+$/ to visible text before text_hash and text_length
are computed in main-pipeline/manifestGenerator.mjs (signing time), and to extracted
clean text before the received hash is computed in main-pipeline/verificationTool.mjs
(verification time). Both sides apply identically.

Empirical basis: editor survival matrix of 37 runs across 13 editors,
July 7 2026. Trailing characters observed from automatic editor behavior:
  U+000A — Google Docs copy-out
  U+0020 — Word Browser copy-out
  U+0020 + U+000A — LinkedIn post and Instagram compose (user-typed space)
  U+0020 only — all other editors (user-typed space)
No U+00A0, U+000D, or other character observed. \r included as
zero-cost conservative addition for untested Windows Word.

Files changed: main-pipeline/manifestGenerator.mjs, main-pipeline/verificationTool.mjs.
No migration required — no existing signed manifest in the test
environment had a trailing strippable character.

### A.9 removal
Removed A.9 structured extraction path from main-pipeline/verificationTool.mjs.
Removed: extractStructured import, BEGIN_DELIMITER, END_DELIMITER,
second try block in extractEmbeddedManifest(), removeStructuredManifestBlock().
A.8 is now the only extraction path.

Rationale: the signing pipeline never produces A.9 output. Any document
reaching the A.9 fallback was one where A.8 was stripped — evidence of
tampering, not a legitimate alternate path. The fallback created a
scenario where evidence of stripping produced a passing verification
result. Removing it closes that gap.

Files changed: main-pipeline/verificationTool.mjs.

### Trailing artifact instrumentation and verification log
Added trailing_artifact field to buildSurvivalAnalysis() in
test/lps-local-test-server.mjs. Records raw characters and Unicode code
points of any text appended after signed_text_length in the extracted
clean text. Appends each survival row as JSONL to verification-log.jsonl
in the repository root after every /api/verify call. verification-log.jsonl
added to .gitignore. README.md updated with local testing note.

Files changed: test/lps-local-test-server.mjs, .gitignore, README.md.

### clean_text exposure
Added clean_text field to verified return (STEP 5) and both failed
hash-mismatch returns (STEP 4) in main-pipeline/verificationTool.mjs. Required for
trailing_artifact computation in the local test rig.

Files changed: main-pipeline/verificationTool.mjs.

## 2026-07-06 — Local survival-analysis rig moved to root pipeline

- Removed dependency on the stale `survival-test-tool` demo path. Local
  survival testing now uses the root `generateManifest -> signManifest ->
  embedManifest -> verifyManifest` pipeline through
  `test/lps-local-test-server.mjs`.
- Corrected the root embed path to keep using `c2pa-text` A.8 invisible
  Unicode variation selectors for local editor survival testing. A.9
  structured extraction remains supported by the verifier for compatibility,
  but the local copy path no longer falls back to a visible ASCII-armour
  comment block.
  Superseded by 2026-07-07: A.9 extraction path removed entirely
  from main-pipeline/verificationTool.mjs. A.8 is now the only extraction path.
  The compatibility statement above no longer reflects current
  behavior. See 2026-07-07 entry.
- Superseded the earlier 220-byte A.8 fallback threshold assumption. With the
  current `c2pa-text` wrapper implementation, larger manifests create longer
  invisible selector payloads rather than requiring visible A.9 fallback.
- Added local-test certificate handling to `verifyManifest()` as an explicit
  option. Production verification remains HTTPS allowlist based; the local
  server opts into local `cert.pem` resolution so manual editor tests do not
  depend on internet certificate fetches.
- Updated `test/lps-local-test-server.mjs` to return embedding diagnostics and a
  survival-analysis row containing editor, platform, copy path, status,
  reason, text lengths, recovered embedding method, and disclosure outcome.
- Updated `test/testVerification.mjs` to use the main-pipeline signer again after removal
  of the demo survival-test-tool folder.

## 2026-07-06 — Local signing-material mismatch guard

- Added a pre-signing consistency check in `main-pipeline/signingLayer.mjs` to confirm
  that `private.pem` and `cert.pem` are a matching key pair before any
  signature is produced. A mismatch now fails closed with
  `Signing material mismatch: private.pem does not match cert.pem`.
- Clarified the verifier failure reason for invalid signatures. The
  previous wording implied the manifest had necessarily been modified
  after signing; the new wording states that the signature could not be
  verified with the advertised certificate.
- Removed the signer fingerprint console log from the signing path. The
  certificate fingerprint remains in the signed manifest, but signing no
  longer emits it as routine console output.
- Documentation updated to distinguish A.8 carrier survival from signing
  material validity. A survived manifest can still fail verification if
  the local certificate does not match the private key used to sign it.

## 2026-07-06 — Explicit-parameters key and certificate replaced (GG.6)

- Found: `private.pem` was generated by LibreSSL's `ecparam` command on
  macOS, which embeds explicit curve parameters (prime field, coefficients,
  generator point, order, cofactor) inside the PKCS#8 envelope instead of
  the named-curve OID (`prime256v1`). Node.js and panva/jose accept both
  forms — the pipeline worked correctly. Stricter ASN.1 parsers used by
  external verifiers may reject explicit-parameters keys.
- Found: LibreSSL 3.3 (macOS system OpenSSL) cannot perform named-curve
  conversion — `-param_enc named_curve` errors at the ASN.1 layer. Homebrew
  OpenSSL 3 (`/usr/local/opt/openssl@3`) was used for the conversion.
- Conversion: extracted to traditional EC format via `openssl pkey
  -traditional`, re-encoded with named-curve OID via `openssl pkcs8
  -topk8 -nocrypt`. Scalar preservation confirmed by public key diff —
  output identical before and after conversion. Named-curve encoding
  confirmed via `grep ASN1 OID` returning `prime256v1 / NIST CURVE: P-256`.
- `cert.pem` regenerated from converted `private.pem` — original certificate
  carried the same explicit-parameters encoding as the original key.
  Public key in new certificate confirmed matching. Updated certificate
  pushed to `systemacticco-rgb/lps-certificates` main branch.
- Full test suite confirmed passing after swap: test/testSigning.mjs and
  test/testVerification.mjs all pass including SIGNING_ENABLED killswitch,
  evaluateDisclosureThreshold unit tests, clean verification, adversarial
  tamper, and small-edit disclosure cases.
- Canonical key generation command recorded in SPEC §3 and README key
  generation block. `openssl ecparam` must not be used — produces
  explicit-parameters encoding on LibreSSL. Use `openssl genpkey
  -algorithm EC -pkeyopt ec_paramgen_curve:P-256` exclusively.
- Commit: d28026aa — `cert.pem` only. `private.pem` is gitignored and
  was never committed.

## 2026-07-04 (7:31pm) — Disclosure-threshold call-site defect fixed

- Found: the disclose-branch in `main-pipeline/verificationTool.mjs` STEP 4 contained
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
- Tests: two new pipeline-level cases added to `test/testVerification.mjs`,
  both run through the real `generateManifest → signManifest →
  embedManifest → verifyManifest` pipeline, not the isolated pure-
  function calls:
  - small-edit (2% length delta): `failed` status, `original_manifest`
    disclosed. Confirmed passing in the real environment.
  - large-mismatch (fixed-string tamper landing beyond the 10%
    threshold): `failed` status, `original_manifest` withheld.
    Confirmed passing in the real environment — this case previously
    only logged output with no assertion; it now asserts explicitly.
## 2026-07-05 (later) — Run 1 assertion strengthened to check segment content

- Found: test/testVerification.mjs's Run 1 assertion (the clean-verification
  case) only checked that `result.status === 'verified'` and that
  `result.segments` was an array. It did not check what was inside
  that array. A pipeline bug that scrambled segment values — wrong
  origin, wrong offsets, wrong confidence — while still returning
  `status: 'verified'` and some array called `segments` would have
  passed this assertion undetected.
- Fix: assertion rewritten to compare each returned segment's
  `segment_id`, `origin`, `start_offset`, `end_offset`, `confidence`,
  and `ai_tool` against the known input values used to build the test
  manifest.
- Along the way: confirmed that `main-pipeline/manifestGenerator.mjs` intentionally
  normalizes confidence to a 0–100 integer scale — a 0–1 decimal input
  like 0.95 is detected and converted to 95. This is existing, correct
  behavior, not a defect. The first version of this stronger assertion
  incorrectly expected the pre-normalization decimal value and failed
  for that reason alone; corrected to expect the normalized integer.
- Confirmed passing against real console output from the actual
  pipeline, not a sandbox run.

## 2026-07-03 (11:18pm) — Disclosure-threshold testability refactor
- Extracted the D.6 length-mismatch disclosure decision out of
  `verifyManifest()`'s inline STEP 4 logic into a standalone exported
  function, `evaluateDisclosureThreshold()`, in `main-pipeline/verificationTool.mjs`.
- Reason: the inline version could not be unit-tested directly — no
  real pipeline input produces a manifest missing `text_length`, so
  that edge case was untestable without this extraction.
- Added 8 direct unit test cases to `test/testVerification.mjs`: missing
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
  chars) implemented in `main-pipeline/registryClient.mjs` ahead of the Supabase
  insert. The `generating_id` structural schema question (opaque
  token vs. structured identifier) was explicitly left open and
  deferred to working-group input — see SPEC.md §9.
- D.2: `main-pipeline/compression.mjs`'s `compress()` now omits `lv`/`st` when they
  match v0.1 defaults; `decompress()` fills defaults on absence.
  Brings code in line with what README §3.2 and SPEC §4.1 already
  claimed.
- D.3: `anchor_hmac` shortcode deliberately not added to SPEC §4.1's
  dictionary — belongs to PROPOSAL 005, whose key hierarchy is still
  undecided. Revisit once that decision locks.
- D.4/D.8 [historical; superseded for the current contract]:
  `confidence_source` was added to all three example segments in
  README §3.2; `ai_tool` added to the `s002` example (missing despite
  the code always producing it). The then-current documentation described a
  third `derived` value. The audited current contract recognizes only `tool`
  and `fallback`.
- D.5: `anchor_hmac` removed entirely from `main-pipeline/compression.mjs` — the
  `FIELD_MAP` entry and both `compress()`/`decompress()` read/write
  lines. Field was never populated by `main-pipeline/manifestGenerator.mjs`; no
  document claimed it was implemented, so removal created no new
  discrepancy.
- D.6 [historical; superseded for the current contract]: `text_length` field
  added to the manifest schema. The audited current contract defines it as the
  byte length of canonical UTF-8 text, not `visibleText.length`.
  Protected by the same signature covering the rest of the manifest.
  `original_manifest` disclosure in the `failed` state now gated by a
  10% length-mismatch threshold in `main-pipeline/verificationTool.mjs` STEP 4.
  Shortcode `tl` added to `main-pipeline/compression.mjs`. README §3.2 and SPEC
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
- Kept the full operational registry architecture separate from the v0.1 stub.

## 2026-06-20 — Compression and capacity work

- Measured manifest size against the Unicode variation selector capacity ceiling.
- Added shortcode compression as a core v0.1 size reduction step.
- Documented the move toward CBOR encoding as a later optimization.
- Established the 220-byte trigger threshold for fallback embedding behavior.
- Separated the current A.8 embedding path from the future A.9 / redundant-embedding path.

Superseded on 2026-07-06: the 220-byte fallback threshold and
256-byte ceiling assumption do not describe the current `c2pa-text`
A.8 wrapper behavior. Larger manifests create longer invisible
selector payloads rather than requiring visible A.9 fallback. Proposal
005 redundant embedding is now described as A.8R, an A.8-derived
invisible redundant chunk carrier, not standard C2PA Text A.9.

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

- [Historical; superseded] Defined LPS as a span-level AI contribution
  provenance schema. It is not a C2PA-compatible workflow claim.
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
- Test coverage: three cases added to test/testSigning.mjs — unset,
  explicitly 'false', and 'true'. First two assert the exact
  killswitch error message and confirm the guard fires by strict
  string equality (not truthy/falsy — '1', 'yes', and '' all fail
  closed). Third confirms the guard does not block signing when
  enabled, restoring the original SIGNING_ENABLED value afterward
  regardless of outcome. Confirmed passing.

## Change-log rule

If a feature is not explicitly marked as built, treat it as specified or planned rather than implemented.
