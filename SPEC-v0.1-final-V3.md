# LPS Reference Implementation — Technical Specification
Version: 0.1-draft
This document mixes implemented behavior with forward-looking
architectural specifications. Every section must explicitly
identify whether it is Built, Defined, Planned, or Placeholder.
Status: [IMPLEMENTED / PROPOSED] v0.1-draft — core pipeline built and
locally tested; PROPOSAL 005 sections are specified or planned, not
implemented. LPS v0.1 is the dominant long-term signed-manifest system.
PROPOSALS 006 and 007 are optional mechanisms outside v0.1
implementation status. PROPOSAL 007 is a parallel, provisional,
cooperative AI-only marker proposal; human span markers are removed
from its main grammar. It is not an implemented replacement.

---

## 0. Principles
- Security above all other concerns
- One component per file, one concern per function
- No mixed responsibilities
- Audited libraries only — no custom cryptographic implementations
- Every function must be independently testable
- AI agents follow this specification exactly. If implementation
  status is not explicitly marked as built, treat the feature as
  undefined rather than making architectural assumptions.

[HOLD — LANGUAGE MIGRATION] JavaScript/Node.js is the reference runtime
for v0.1. Runtime latency, typed contracts, binary-hash handling, CPU
concurrency, and cross-language transport are production dependencies,
not submission blockers. This specification defines no migration plan,
benchmark, or production-service architecture.

---

## 1. Input Format [DEFINED — v0.1]
What the manifest generator receives as input.
- Content: string (plain text for v0.1)
- Segments: array — start offset, end offset, origin type
- Origin types: "human" | "ai_generated" | "ai_modified_human"
- AI tool identifier: string
- Modification degree: float 0-1 (required for ai_modified_human only)
- Confidence: integer 0-100 (see 1.1)
- Timestamp: ISO 8601

---

## 1.1 Confidence Value — Source of Truth and Fallback [DEFINED — v0.1]

### Primary source — mandatory
The generating AI tool is the authoritative source of confidence.
When an AI tool produces or modifies a segment, its API response
must supply the confidence value for that segment directly.
This is the only source that reflects first-person certainty
about the origin classification. No other source supersedes it.

### Fallback source hierarchy
When the generating tool does not supply a confidence value,
the following sources are used in priority order:

1. Output from an approved AI detection classifier, mapped to 0–100.
2. Human reviewer manual assignment, integer 0–100.
3. Mathematical fallback — see 1.2.

### Validation rules at entry point
generateManifest() applies these rules to every segment:
- Confidence must be an integer between 0 and 100 inclusive.
- If confidence is a float (e.g. 0.95), multiply by 100 and round
  to nearest integer.
- If confidence is absent, the mathematical fallback defined in
  1.2 runs automatically.
- If confidence is present but outside 0–100 range,
  generateManifest() throws.
- Confidence is never null in the output manifest.
  The fallback guarantees a value.

### Modification degree
Cannot be derived mathematically. The pipeline never sees the
original human text before AI modification occurred. Only the
tool that performed the modification knows the before state.
If modification_degree is absent on an ai_modified_human segment,
generateManifest() throws. It is a required field with no fallback.

---

## 1.2 Confidence Fallback — Mathematical Derivation [BUILT — 2026-06-19]

When no confidence value is supplied by the generating tool or
any fallback source, generateManifest() calculates a rough
approximation from the segment's own character distribution
relative to the full document.

### Method
For each segment, calculate the proportion of characters
belonging to each origin type across the full document.
A segment whose character range is dominated by a single origin
type receives a higher fallback confidence than a mixed or
ambiguous range. The fallback confidence assigned to a segment
equals the document-wide percentage of characters sharing
that segment's origin type, floored to the nearest integer.

### Example — document of 507 characters, seven segments
  aig   0–20    =  21 chars
  p     20–30   =  11 chars
  aig   30–90   =  61 chars
  aimh  90–120  =  31 chars
  aig   120–200 =  81 chars
  aimh  200–250 =  51 chars
  aig   250–500 = 251 chars

  Total characters:             507  (offsets inclusive)
  AI-generated (aig):           414 chars = 81.66%
  AI-modified human (aimh):      82 chars = 16.17%
  Human (p):                     11 chars =  2.17%

  Fallback confidence for an aig segment  = floor(81.66) = 81
  Fallback confidence for an aimh segment = floor(16.17) = 16
  Fallback confidence for a p segment     = floor(2.17)  =  2

### Important constraint
Mathematical fallback confidence is a structural approximation,
not a forensic measurement. It reflects document-level character
distribution, not signal strength for any individual segment.
The manifest must record that fallback was used so a verifier
knows the confidence value was not supplied by the generating tool.

### Fallback flag — confidence_source
Every segment in the output manifest carries a confidence_source
field recording how its confidence value was produced.

  confidence_source: "tool"     — supplied directly by the
                                  generating AI tool.
  confidence_source: "derived"  — supplied by a classifier or
                                  human reviewer.
  confidence_source: "fallback" — calculated by mathematical
                                  derivation defined in 1.2.

This field survives compression, embedding, and verification
intact. A verifier must surface it alongside the confidence
value so the distinction is never hidden from the reader.

### Shortcode — confidence_source [BUILT — 2026-07-03]
confidence_source is a manifest field present in the v0.1 shortcode
dictionary and implemented in compression.mjs:

  csrc = confidence_source

### Implemented behavior [BUILT — 2026-06-19]
generateManifest() in manifestGenerator.mjs:
1. Accepts optional confidence per segment.
2. Calls calculateFallbackConfidence(segments) before segment
   mapping begins. This produces a fallback confidence value
   per origin type from the raw input segments, independently
   of the proportion calculation loop.
3. During segment mapping, detects absence of confidence on
   each segment and assigns the pre-computed fallback value
   for that segment's origin type.
4. Writes confidence_source on every segment in the output.
The fallback calculation runs before segment mapping and before
the totalCharCount, aiCharCount, and humanCharCount proportion
variables are computed. It operates on the raw input segment
array via confidenceFallback.mjs.

In v0.1, manifestGenerator.mjs emits confidence_source: "tool" for any supplied confidence value and confidence_source: "fallback" for absent confidence. The value "derived" is defined in the schema for future classifier or human-reviewer integration and is not produced by the current implementation.



Open question: how does the tool know segment boundaries?
Approach 1 — provided by the AI tool at creation time [PREFERRED]
Approach 2 — estimated post-hoc by detection layer [FALLBACK]

---

## 2. Manifest Schema [DEFINED]
Defined in README.md section 3.2 of the proposal repository.
Reference: https://github.com/systemacticco-rgb/linguistic-provenance-schema#32-what-lps-records
Do not duplicate the schema here.
Any schema changes must be made in the proposal repository first,
then reflected in this implementation.

---

## 3. Signing Layer [SECURITY-CRITICAL]
Algorithm: es256 (ECDSA P-256, SHA-256, raw r‖s signature encoding)
Library: Node.js built-in crypto module (no install required)
Signature encoding: IEEE P1363 (raw r‖s, 64 bytes fixed for P-256).
  Required because the JOSE/COSE "ES256" identifier specifies
  raw r‖s encoding, not DER. Node's default sign()/verify()
  output is DER — must explicitly pass
  { key, dsaEncoding: 'ieee-p1363' } to both createSign().sign()
  and createVerify().verify() calls. Confirmed June 30 2026:
  internal round-trip (testSigning.mjs, testVerification.mjs)
  and external cross-check against the independent panva/jose
  library both pass. The primitive signature encoding produced by
  signingLayer.mjs matches ES256's raw r‖s expectation. LPS does
  not currently emit JWS or COSE_Sign1 envelopes, so full
  envelope-level JOSE/COSE interoperability remains unimplemented.
Note: c2pa-text is used in component 3 (embedding layer) only,
      not for signing. Signing uses native crypto exclusively.
      @contentauth/c2pa-node is listed in package.json but is
      not imported by the embedding layer directly.
Note: use @contentauth/c2pa-node only for the embedding layer.
      Do not use the original c2pa-node package.
Key format: PEM
Certificate generation commands:
[UPDATED — 2026-07-06] Canonical key generation — named-curve PKCS#8.
Prior commands used openssl ecparam which produces explicit-parameters
encoding by default on LibreSSL (macOS). Node.js and panva/jose accept
both forms, but stricter ASN.1 parsers used by external verifiers may
reject explicit-parameters keys. Use the following commands only:

openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
  -out private.pem
openssl req -new -x509 -key private.pem -out cert.pem -days 365 \
  -subj "/CN=lps-reference-implementation-v0.1" \
  -addext "subjectKeyIdentifier=hash" \
  -addext "authorityKeyIdentifier=keyid:always" \
  -addext "basicConstraints=critical,CA:FALSE"

private.pem — gitignored, never committed.
cert.pem — committed for v0.1 testing only.

private.pem and cert.pem must be generated and rotated as a matching
pair. The signing layer must compare the public key derived from
private.pem with the public key inside cert.pem before signing. If they
do not match, signing must fail closed with:
Signing material mismatch: private.pem does not match cert.pem

Certificate delivery — v0.1:
cert.pem is not embedded in the manifest. It is hosted publicly at:
https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem
The manifest carries two fields instead:
cert_url — the public URL of the certificate. Locked to production
HTTPS URL as of 2026-07-08. The file:// local path was a testing
placeholder and was never appropriate as a permanent value.
See CHANGELOG.md 2026-07-08 entry. [BUILT — 2026-07-08]
cert_fingerprint — SHA-256 hash of the certificate content.
The verification tool fetches the certificate, computes a SHA-256 hash of its DER-encoded bytes (X509Certificate.raw — not the PEM string), confirms it matches cert_fingerprint, then uses it to verify the signature. The signing layer computes cert_fingerprint the same way at sign time. Both sides must use DER bytes or the comparison is sensitive to PEM text encoding differences across platforms and network responses.
Repo: systemacticco-rgb/lps-certificates (public)

Constraints:
- Never implement signing logic manually
- Key material never logged, never hardcoded, never in client-accessible variables
- Signing and verification are separate files, separate functions,
  zero shared mutable state
- SIGNING_ENABLED environment variable checked first in every
  signing function before any key access
  [BUILT — 2026-07-05] Implemented as the first statement in
  signManifest(), before privateKey or certificate file reads.
  Operational killswitch only — controls whether this code path
  will sign, not whether private.pem itself is protected. See
  CHANGELOG.md 2026-07-05 entry.
- Local signing-material consistency checked before signing. This is a
  development safety guard, not a verifier trust-list mechanism. It
  prevents the local pipeline from producing manifests signed by one key
  while advertising an unrelated certificate.

Why not a C2PA media library for signing:
@contentauth/c2pa-node is designed to sign media files — images,
video, audio. It embeds C2PA manifests into binary media containers.
LPS signs JSON text manifests, not media files. Node.js built-in
crypto signs any data format directly. No external dependency,
no binary compatibility risk, no version management required.
The embedding layer uses c2pa-text, a separate package handling
Unicode variation selector embedding for plain text. Signing and
embedding are separate concerns using separate tools.

HMAC key derivation for anchor manifests: [PLANNED — PROPOSAL 005 — pending key hierarchy lock]
HKDF-SHA256 is the selected primitive, replacing the earlier
createSign-based draft shown in prior versions of this section.
It is defined using Node's built-in crypto.hkdfSync('sha256', ikm,
salt, info, 32). No external dependencies. Consistent with the
no-external-crypto constraint. ikm, salt, and info are not yet
defined and remain locked to the pending key-hierarchy decision — locked
together as one decision covering root keying material, whether
anchor keys derive from the signing key or a separate master
secret, and how future keys (registry, token, rotation) extend
the hierarchy without rework. This section is rewritten once with
final values once that decision locks, then treated as immutable —
same rule as the shortcode dictionary.

---

## 4. Embedding Layer [BUILT — 2026-06-19]
Library: encypherai/c2pa-text (MIT licensed)
Method for v0.1: Unstructured A.8 — Unicode Variation Selectors
Reason: [PENDING CROSS-CHECK] scoped copy/paste observations support
research use; transport preservation is not universal
Constraint: embedding and extraction are separate functions
Constraint: never modify content during embedding

Extraction output format: object with properties manifest (Uint8Array),
cleanText (string), offset (number), length (number).
Comparison must target extracted.manifest, not extracted directly.

Known limitation: larger manifests create longer invisible wrapper
sequences, which may reduce editor survival in practice. This is an
operational survival constraint, not an embedding-layer fallback trigger.
Capacity threshold: [DEFINED — June 2026]

[PENDING CROSS-CHECK] Five-segment reference measurement after full compression pipeline:
Raw JSON with certificate:              2026 bytes
After certificate removal:              1219 bytes
After shortcode compression:             843 bytes
After CBOR encoding:                     737 bytes
Former assumed ceiling:                  256 bytes

[PENDING CROSS-CHECK] The `c2pa-text` A.8 wrapper can produce longer
invisible payloads for larger manifests. Production limits depend on
external editor latency, platform reclassification, token overhead, and
transport preservation; the reference implementation does not establish
a production deployment claim.

The current v0.1 plain-text carrier is A.8 invisible Unicode variation
selectors. Any structured visible-text carrier is not part of the v0.1
pipeline and must not be treated as a fallback. A.8 is the only
extraction path. [SECURITY / LIMITATION] A.8 and the proposed A.8R
carrier retain the Unicode-conformance concern identified for the C2PA
unstructured variation-selector scheme. This is a carrier and adoption
limitation, not a claim that the cryptographic signature layer is
invalid.

[PROPOSED] Redundant embedding — PROPOSAL 005/A.8R — post-v0.1. A.8R
is complementary LPS redundant-manifest and partial-recovery research,
not an independent system or C2PA Text A.9. Its paragraph copies,
overlap, and reconstruction mechanisms remain specified rather than
implemented; they do not cure the A.8 carrier conformance concern or
establish transport survival.
Two new verification states defined for PROPOSAL 005:
[DEFINED — PROPOSAL 005] anchor_only and
[DEFINED — PROPOSAL 005] partial_recovery.
Chunk header format: seq uint16 + total uint16 + copy_id uint8
+ version uint8 = 6 bytes prepended to each A.8R chunk payload.

[HOLD] A.8R arbitrary-position embedding is a wrapper-level research
direction: visible text would be split, an existing A.8 operation
applied to the prefix, and the suffix rejoined. It remains
unimplemented and does not establish third-party interoperability or a
verifier contract. The details remain pending PROPOSAL 005 scope
confirmation.

[HOLD] Any future A.8R carrier specification would need an explicit
placement and verifier contract. No arbitrary-position or third-party
verifier rule is locked by v0.1.

[OPEN-7 — 2026-07-09] Overwrite and re-signing contract undefined. When an AI tool receives text already carrying a valid LPS manifest and produces modified output, no defined contract exists for: (a) whether the output must carry a new manifest referencing the prior one as a provenance chain, (b) whether manifest bytes surviving in the output must be stripped before re-signing, (c) whether a verifier encountering a physically present but semantically invalid manifest from a prior signing cycle must surface this condition explicitly. No resolution adopted. This must be defined before any AI tool integration guidance is published.

---

## 4.1 Manifest Compression — Shortcode Dictionary [BUILT — 2026-07-03]

All field names and origin values are shortened before embedding.
The verification tool expands them using this dictionary.
Dictionary is versioned and immutable — existing codes never change.
New codes may be added in future versions only.

### Field name codes — v0.1
lv   = lps_version
th   = text_hash
tl   = text_length
cs   = content_segments
sid  = segment_id
so   = start_offset
eo   = end_offset
or   = origin
cf   = confidence
ait  = ai_tool
md   = modification_degree
oaip = overall_ai_proportion
hp   = human_proportion
st   = signing_tool
sa   = signed_at
m    = manifest
sig  = signature
cu   = cert_url
cfp  = cert_fingerprint
csrc = confidence_source
alg  = algorithm

### Algorithm field value convention [DEFINED — June 30 2026]
The `algorithm` field (shortcode `alg`) uses the internal string value `es256` to label the cryptographic primitive used in signing: ECDSA over the P-256 curve with `SHA-256` using `IEEE P1363` `r‖s` encoding. This is an LPS-internal naming convention and does not represent a `COSE` or `JOSE` algorithm identifier. In `COSE`, the equivalent algorithm is identified as `ES256` with integer value -7; in JOSE, the equivalent identifier is the string `"ES256"`. LPS does not currently implement either `COSE` or `JOSE` envelope formats, and therefore does not use their identifiers directly in the manifest structure. Future envelope-level interoperability `(COSE_Sign1 / JWS)` may adopt the standard identifiers directly (see Section 9).

### Origin value codes — v0.1
h    = human
aig  = ai_generated
aimh = ai_modified_human

### Version identifier codes — v0.1
lps-v0.1 = lps-reference-implementation-v0.1

### Default field assumption [DEFINED]
lv and st are omitted at embed time in v0.1.
Verification tool assumes lps-v0.1 defaults if absent.
If non-default values are present they override the assumption.
This rule is a schema contract — both embedder and verifier must
implement it. Defined in README.md section 3.2 as authoritative.

### Confidence encoding [DEFINED]
Confidence stored as integer 0-100, not float 0.0-1.0.
Example: 0.95 stored as 95. Division by 100 on extraction
for display is specified but not implemented in v0.1 —
verificationTool.mjs returns raw integers. Consumers should
expect integers in the range 0-100 from the current
implementation.
Defined in README.md section 3.2 as authoritative.

### CBOR binary encoding [BUILT — 2026-06-20]
JSON serialization replaced with CBOR binary format.
Drops quotes from keys, encodes numbers as binary not text digits.
Estimated additional saving: 50-70% reduction in numeric field size.
The verification tool deserializes CBOR on extraction before
expanding the shortcode dictionary.

---
## 4.2 Production Constraints and Safe Operating Ranges [PENDING CROSS-CHECK]

[PENDING CROSS-CHECK] The candidate 3–10-segment range of 400–1,500
compressed bytes and its associated invisible-character counts are
scoped observations, not a production safe-operating guarantee.

[PENDING CROSS-CHECK] Latency and reclassification observations are
editor- and platform-specific. They do not establish a protocol limit,
universal carrier preservation, or a production throughput claim.

[PENDING CROSS-CHECK] AI compose-input reclassification, renderer
behaviour, and transport preservation are external platform
dependencies. No production ceiling is locked.

Token overhead: text carrying large invisible Unicode payloads incurs increased token consumption when processed by any language model. Variation selectors are not collapsed by tokenizers — each character consumes token budget. Integrations passing LPS-embedded text to language model APIs must account for this overhead. This must be stated explicitly in integration documentation before any production deployment guidance is published.

[PENDING CROSS-CHECK / LIMITATION] LPS manifests must not be embedded
inside code syntax blocks in v0.1. Code renderers may display invisible
Unicode characters as visible markers. GitHub file-level preservation
is scoped evidence, not a universal claim. The constraint applies to
inline and fenced code blocks only, not to file-level code assets.

[LIMITATION] LPS has no defined carrier or segment role for AI-generated
code in code-block environments. Inline code-block embedding is outside
v0.1 scope; no carrier mechanism for code blocks is defined.

---

## 5. Verification Tool [BUILT — 2026-06-19]
Input: file or text string with embedded manifest
Steps in order:
1. Extract manifest from content
2. Check signature against public key
3. Check certificate validity
4. Strip trailing /[\r\n ]+$/ from extracted clean text, then hash
   the stripped result and compare against text_hash in manifest.
   The same strip is applied at signing time in manifestGenerator.mjs
   before text_hash and text_length are computed. Both sides must
   apply the strip identically or the hash comparison is meaningless.
   If mismatch after strip: return failed with reason.
5. Render contribution breakdown.

Output — verified: signal intact, signature valid, text hash matches.
  Returns: status, signed_at, algorithm, embedding_method_used,
  clean_text, disclosure_threshold_outcome, signed_text_length,
  received_text_length, overall_ai_proportion, human_proportion,
  segments array with full breakdown.

Output — failed: signal found but signature invalid, or visible
  text hash does not match. Returns: status, reason, signed_at,
  algorithm, embedding_method_used, clean_text,
  disclosure_threshold_outcome, signed_text_length,
  received_text_length. Also returns original_manifest when
  disclosure_threshold_outcome is within_threshold, embedding_method_used, clean_text,
  disclosure_threshold_outcome, signed_text_length,
  received_text_length. Also returns original_manifest when
  disclosure_threshold_outcome is within_threshold.

Output — degraded: signal absent or corrupted. Returns: status,
  reason, anti_forensic_note.

Output — registry_required: signal absent and an exact visible-text hash
  matches an existing generation-time registry record. Returns: status,
  reason, registry_record with token, content_hash, generating_id,
  created_at. This does not restore span-level evidence or establish
  why the carrier is absent.
  Implemented in v0.1 stub — registryClient.mjs.
  Full production architecture: see working-group-submission.md §8.1.

Constraint: verification never modifies the input
Constraint: certificate revocation checking is part of the
intended production verification architecture. The current
reference implementation does not yet implement revocation
checking and must not imply that this capability already exists.

The verification outputs below are architectural definitions
specified for PROPOSAL 005. They describe the intended
verification model but are not produced by the current v0.1
reference implementation. Their implementation status remains
Defined until the corresponding components are built,
integrated, and verified.

[DEFINED — PROPOSAL 005] Output — anchor_only: no full manifest recoverable, anchor manifests present and HMAC-validated. Returns: text_hash, overall_ai_proportion, human_proportion, algorithm, signed_at. No segment breakdown. No signature verification. Anchors failing HMAC are discarded before fallback decision. anchor_layer field values: present | absent | conflict.

[DEFINED — PROPOSAL 005] Output — partial_recovery: manifest partially reconstructed from cross-copy surviving chunks. Returns: reconstructed fields, missing seq positions list, reconstruction map. Signature verification did not run.

[DEFINED — PROPOSAL 005] Output — injection_detected: valid chunks found from multiple certificate sources during reconstruction. Session certificate anchor established from first valid assembly. Subsequent assembly produced a different cert_url or cert_fingerprint. Returns: status, session_cert_fingerprint, injected_cert_fingerprint, signed_at from session manifest. Forensic value: active adversarial injection attempt recorded with both certificate fingerprints as evidence.

[PLANNED — PROPOSAL 005] Output — reconstruction_corrupted: chunk reconstruction attempted but failed to produce a verifiable manifest. Chunk headers present but sequence is unresolvable, byte integrity cannot be confirmed, or reassembled bytes do not decompress or parse. Return fields and failure subcategories not yet defined. Blocked on OPEN-6 raw byte slice contract and chunkLayer.mjs design.

[BUILT — 2026-07-04] original_manifest disclosure in the failed state
is gated by a length-mismatch threshold, locked at 10% of
text_length. verificationTool.mjs STEP 4 computes the absolute
difference between the stripped received text's length and the
manifest's text_length field; if that difference exceeds 10% of
text_length, original_manifest is withheld and the failed response
returns only status, reason, signed_at, and algorithm. This prevents
an adversary from using extreme-mismatch replay to study document
structure via repeated submissions. text_length is a plain
manifest field, protected by the same signature that covers the
whole manifest — it requires no separate HMAC or hash of its own.
Note: text_length in the manifest reflects the stripped text length,
not the raw input length. The strip is applied before text_length
is computed in manifestGenerator.mjs.
---

## 6. Server-Side Record Store [PARTIALLY IMPLEMENTED]

Architecture defined in working-group-submission.md §8.1.

A functional registry stub exists in the v0.1 reference
implementation (registryClient.mjs), providing registration
and lookup by token and content hash for demonstration and
testing purposes.

The full production architecture—including trust-list
governance, which is architecturally specified, not yet implemented in v0.1,
credential management, certificate lifecycle,
identity binding, rate limiting, and operational deployment—
remains future work and is outside the current reference
implementation.

### What it is
An append-only server-side log. Every AI-generated output gets
a hash plus timestamp written at generation time. Content is
not stored — only the fingerprint. A presented document can
be checked against this log to confirm it existed, unchanged,
at a specific moment.

### Access model
Hash-level verification is public — any party may submit a content
hash and receive confirmation that a matching record exists.
Access to the original record contents (generating identity,
timestamp details, full registration data) is jurisdictional —
available to legal, governmental, or institutional authorities
through defined access procedures.

This access model reflects the current design intent. The registry
architecture, including tiered access controls and credential
management, is subject to working group input and may be revised
before or after submission.

### Forensic value
[LIMITATION] A registry match can corroborate only an exact
visible-text hash with an existing generation-time record. It is not
proof of authorship, carrier stripping, intent, or span-level evidence.

### Why it is deferred
[LIMITATION] A record must be written at generation time by a producing
system; it cannot be retrofitted by a third party. Provider cooperation
and any regulatory adoption remain external dependencies.

### Architecture decision pending
Foundation-hosted vs federated registry.
PROPOSAL 002 — token binding — shares this infrastructure.
Decision deferred to working group engagement phase.

### v0.1 scope
Stub implemented — June 21 2026.
Two Supabase tables: registry_records and usage_events.
registryClient.mjs: registerContent() and queryRegistry().
verificationTool.mjs: registry_required state wired to
queryRegistry() via content hash fallback.
RLS disabled in stub — service role key is the access boundary.
RLS policies and credentialed access layer deferred to
production deployment phase.

### Input validation constraints — v0.1
Applied in registerContent() before any Supabase insert runs.

- content_hash must be exactly 64 lowercase hex characters.
  Reject anything else with a thrown error before insert.
  generateManifest() already produces this format —
  this is a defence-in-depth measure not a format conversion.
- generating_id: a minimal safety-only check runs before insert —
  non-empty, printable ASCII (0x20-0x7E), 1-128 characters, no
  control characters. This is NOT format validation in the sense
  of enforcing an identity/version schema. The actual structural
  format (opaque token vs. structured identifier, how identity and
  version are represented) is intentionally undecided. This
  safety-only check is expected to be superseded once that design
  question resolves — most likely informed by working group
  feedback rather than decided unilaterally beforehand. Do not
  tighten this into a structured pattern without a full design
  pass. See Section 9 for the open schema question this defers to.
- Rate limit: specified but not yet implemented in v0.1.
  When implemented, it will enforce a maximum number of
  registrations per generating_id per hour and reject inserts
  exceeding the limit before the Supabase call runs.
  Threshold undefined — see Section 9 and PRE-4.
- content_hash and generating_id controls are applied before
  Supabase insert runs. Supabase is never called on invalid
  input for those two fields. Rate limiting is not yet enforced.
---

## 7. Security Constraints — Global [SECURITY-CRITICAL]
These apply to every component without exception:

- No cryptographic algorithm implemented from scratch
- No key material in logs, console output, or error messages
- No mixed concerns — each file has one job
- All dependencies pinned to specific versions
- All dependencies checked against known vulnerability databases
  before use
- Certificate revocation checking is mandatory in production
  architecture. It is not implemented in the v0.1 reference
  implementation. verificationTool.mjs fetches the certificate,
  confirms the fingerprint, and verifies the signature — it does
  not check revocation status. This is a known gap relative to
  full C2PA production requirements. See public README §4.7.
- Input validation on every entry point
- Error messages must not leak internal state
- [PLANNED — PROPOSAL 005] HMAC comparison must use crypto.timingSafeEqual() — never standard equality. No HMAC operations exist in v0.1. This constraint applies when PROPOSAL 005 anchor components are built.
- [PLANNED — PROPOSAL 005] Derived HMAC key material is sensitive. Never logged, never returned in error messages, never stored. Same handling rules as private key material.
- [PLANNED — PROPOSAL 005] Magic prefix secondary validation mandatory — type field must be 0 or 1, version must be 1, total must be greater than 0. Buffers failing secondary checks discarded without further parsing.
- [PLANNED — PROPOSAL 005] Injection volume cap applied before reconstruction begins. Cap formula open — see Section 9.
---

## 8. Test Requirements [BUILT — 2026-07-08]
Each component has a dedicated test file.
June 20, 2026 covered initial terminal-level build verification during
the compression and shortcode work. The formal seven-test suite passes
under production conditions as of July 8, 2026.

### Test files
testManifest.mjs — Component 1
  Confirms: manifest structure, text_hash field present,
  three origin types correct, proportions calculated,
  all fields match schema in README.md section 3.2.

testSigning.mjs — Component 2
  Confirms: signed manifest object structure, signature
  present, cert_url and cert_fingerprint present,
  algorithm correct, signed_at timestamp present.

testEmbedding.mjs — Component 3
  Confirms: visible text unchanged after embedding,
  manifest bytes extractable, manifest recoverable
  from CBOR bytes after decompression.

testVerification.mjs — Component 4
  Confirms: verified state on clean text, failed state
  on tampered text, original_manifest returned on
  text hash mismatch. Local test mode may allow the repository
  cert.pem file URL explicitly so local survival testing does not
  depend on public certificate fetches.

testRegistry.mjs — registryClient.mjs
  Confirms: registerContent() generates correct token format,
  queryRegistry() by token returns correct record,
  queryRegistry() by content hash returns correct record,
  unknown token returns null, missing arguments throws error.

testRegistryVerification.mjs — registry_required state
  Confirms: registry_required state fires when text has no
  embedded signal but content hash exists in registry,
  degraded state fires when text has no signal and no
  registry record.

testConfidenceFallback.mjs — confidenceFallback.mjs
  Confirms: correct integer returned per origin type,
  floor applied correctly, zero guard returns 0 for all origins,
  proportions sum correctly across all segments.

### Adversarial test coverage
Tampered visible text — returns failed. original_manifest is
returned when the length delta is within the 10% disclosure
threshold. original_manifest is withheld when the delta exceeds
the threshold. Both cases confirmed passing in testVerification.mjs
— small-edit (2% delta) discloses, extreme-mismatch (18% delta)
withholds. See CHANGELOG.md 2026-07-04 (7:31pm).
Certificate fingerprint mismatch — returns failed.
Missing signal — returns degraded with anti_forensic_note.
Corrupted signal — returns degraded.

### Proposal 007 browser testing-tool evidence [OBSERVED — SCOPED]

This subsection records optional PROPOSAL 007 testing-tool observations;
it is not a v0.1 A.8 embedding, verification, or test-suite requirement.
PROPOSAL 007 uses a cooperative U+2060–U+2064 marker grammar and remains
forgeable, not cryptographic authentication. Its results do not alter the
v0.1 signed-manifest verification outputs or the Section 5 trailing-strip
rule.

[PENDING CROSS-CHECK] The observations do not confirm round trips through
other browsers or renderers; messengers or social-media platforms; API or
LLM channels; Windows or Linux; sanitizers, crawlers, IDEs, mobile platforms,
or external transports. Those channels remain pending cross-check. The
testing tool does not establish a universal browser clipboard, transport, or
injection-path rule.

For the first retained U+2060 row, ordinary double-click selection and copy
through JavaScript `textContent`, HTML entity, and JavaScript
`insertAdjacentText` injection paths preserved one valid document-level
header and one valid AI pair across Georgia, System UI, and Menlo. The
Proposal 007 verifier recorded one surviving pair against a header total of
one and reported `100.0% (1 / 1)`. The pasted browser-test value contained
two trailing U+000A codepoints. Under the Proposal 007 verifier's defined
trailing-normalization rule, those codepoints are handled as trailing
transport/clipboard whitespace, not application-generated marker content;
the valid document-level header and AI pair survive.

Endpoint-sensitive drag selection produced different pasted codepoint
sequences: a complete document-level header and AI pair, header-only input,
orphaned open or close markers, or no valid document-level header or AI pair.
E007, E008, E011, and `NO_VALID_MARKDOWN_FOUND` where applicable describe
the pasted codepoint sequence only. They do not prove stripping, provenance,
AI origin, or application mutation. Command-modified drag selection was
inconsistent: both full survival and partial or no-valid-signal outcomes were
observed. This is a scoped selection-behaviour observation, not a deterministic
font or injection defect.

| Injection path | Scoped observed selection outcome |
|---|---|
| JavaScript `textContent` | Complete selections survived; modified drag selections could yield orphaned-close/no-valid-signal results. |
| HTML entity | Selection endpoint and drag direction could produce full survival, header-only/orphaned-open results, or no valid signal. |
| JavaScript `insertAdjacentText` | Selection endpoint and drag direction could produce full survival, header-only/orphaned-open results, orphaned-close/no-valid-signal results, or no valid signal. |

[LIMITATION] No injection path is generally safer than another on this
evidence; the observed outcome depends on the selected range. The Proposal
007 verifier uses the E001–E011 result vocabulary. Its pathological generator
exercised controlled verifier inputs with supplied `header total 1 / AI spans
1`; it is not a production embedding path.

| Mode | Observed result |
|---|---|
| Malformed sequence | E001 `TRUNCATED_MARKER` |
| Reordered fields | E002 `INVALID_TYPE` |
| Duplicate header | E006 `DUPLICATE_HEADER`; the first valid document-level header remains authoritative |
| Orphaned open | E007 `ORPHANED_OPEN` |
| Orphaned close | E008 `ORPHANED_CLOSE` |
| Trailing normalization | Valid document-level header and AI pair survive after normalization |
| Internal codepoints | E009 `INTERNAL_SIGNAL`; the valid AI pair remains counted |

[LIMITATION] In the testing tool, re-embedding text that already contains
PROPOSAL 007 signals does not remove the prior signals. Repeated embedding
can create compound input and verifier errors. A production policy for
pre-embedded input remains undefined and requires separate design work; this
does not infer how an LLM, provider, or external system must treat
pre-embedded input.

[OBSERVED — SCOPED] Arabic, Hebrew, and Persian cards use the existing
Georgia, System UI, and Menlo assignments. The PROPOSAL 007 marker grammar
does not use LRM, RLM, bidi embeddings, overrides, or isolates. RTL
visual-selection behaviour and copied-range boundaries remain
browser-rendering/selection concerns, not evidence that language content
strips markers. The row labelled U+2060 contains a complete document-level
header and full AI open/close pair; it is not an isolated-U+2060 survival
test. Bidi transport, renderer, accessibility, and cross-platform questions
remain pending cross-check.

### Outstanding test gaps
- Malformed CBOR input to verificationTool.mjs
- [Closed 2026-07-07] A.9 extraction test gap — closed. A.8 is the only extraction path. No A.9 test required or applicable.
- Certificate fetch failure — network unavailable scenario
- Chain depth test — not applicable until multi-round provenance is implemented
- [Closed 2026-07-04] Replay attack detection — failed state with extreme text length mismatch must not return original_manifest. Confirmed passing in testVerification.mjs (18% delta case). See CHANGELOG.md 2026-07-04 (7:31pm) entry.
- Registry input validation — content_hash format and
  generating_id safety check: covered by testRegistryValidation.mjs
  as of 2026-07-03 D.1. Rate limit enforcement: not yet built
  and not yet testable. See PRE-4.
- PROPOSAL 005 verification states not yet testable: [PLANNED — PROPOSAL 005] anchor_only, [PLANNED — PROPOSAL 005] partial_recovery, [PLANNED — PROPOSAL 005] injection_detected, and [PLANNED — PROPOSAL 005] reconstruction_corrupted. Blocked on PROPOSAL 005 implementation. All chunk-layer, reconstruction, anchor HMAC, injection detection, and magic prefix test cases belong to the PROPOSAL 005 build phase.

---

## 9. Open Questions — Blocking
These are unresolved or tracked items. Items already built or locked are
retained here only when they record a closed decision or a remaining
follow-up.
- [x] Signing algorithm selection — BUILT, ES256 ECDSA P-256
      with IEEE P1363 raw r‖s encoding as of 2026-06-30.
- [ ] Key storage method for v0.1
- [ ] [PENDING CROSS-CHECK] Capacity limits for Unicode variation selectors
      No protocol hard ceiling is defined by this specification.
      Editor-processing latency and platform behaviour remain external
      measurements; see §4.2.
- [x] Passing/failing/degraded output format — BUILT, JSON, four states
      established in the v0.1 pipeline as of 2026-06-19.
- [ ] Certificate rotation procedure
      v0.1 certificate expires 365 days from generation.
      Procedure for rotating to a new certificate without
      breaking verification of documents signed with the
      old one is not defined. Requires: new cert generation,
      new lps-certificates repo commit, new cert_url and
      cert_fingerprint in signingLayer.mjs, decision on
      whether old signed documents remain verifiable.
      [OPEN — pre-working-group-submission item]

- [ ] Multi-round provenance architecture
      Sequential signing rounds — human draft, AI edit,
      human revision — produce multiple signed manifests.
      How the verification tool handles a document that
      has been through multiple signing cycles is not
      defined. Requires: ingredient chain architecture
      decision, chain depth limit, poisoned chain detection.
      Related open items: POST-1 (multi-round provenance
      architecture), OPEN-7 (overwrite and re-signing contract).
      See Appendix A.11 canonical open item registry.
      [OPEN — post-v0.1, pre-working-group-submission]
      
- [ ] [PLANNED — PROPOSAL 005] Minimum document length requirement 
      for paragraph-bound copy model — total payload size must be profiled before implementation. Short documents may not have sufficient characters to carry one full copy per paragraph.

- [ ] [PLANNED — PROPOSAL 005] Anchor manifest signing — deferred to v0.2. Unsigned
      anchors are forensically useful but not cryptographically
      verifiable independently.
      
- [ ] [PLANNED — PROPOSAL 005] c2pa-text chunk header exposure — extraction output
      must expose chunk headers for reconstruction logic.
      May require implementation above c2pa-text layer.
      
- [x] Minor mismatch threshold for original_manifest disclosure
      in failed state — LOCKED at 10% text length difference,
      implemented in verificationTool.mjs. Revisit if forensic
      or legal input post-submission indicates 10% is too tight
      (leaks provenance) or too loose (withholds forensically
      valuable information).

- [ ] [PLANNED — PROPOSAL 005] Injection volume cap formula — paragraphCount ×
      totalChunks × 3 proposed. Needs profiling against
      realistic document sizes before locking. Cap too low
      rejects legitimate buffers. Cap too high allows
      resource exhaustion.

- [ ] Registry rate limit threshold — 100 registrations
      per generating ID per hour proposed. Needs operational
      data to validate. Too low breaks legitimate high-volume
      generation pipelines. Too high allows flooding.

- [ ] generating_id format definition — UUID or versioned
      tool identifier pattern proposed. Needs working group
      input. Format must be flexible enough for third-party
      integrators but strict enough to block arbitrary strings.

- [ ] [PLANNED — PROPOSAL 005] reconstruction_completeness threshold for
      low_confidence_reconstruction flag — 50% proposed.
      Below this threshold the partial breakdown may mislead
      more than it informs. Needs forensic input on minimum
      viable segment coverage for a report to be admissible.

- [ ] [PLANNED — PROPOSAL 005] anchor_layer: absent flag — defines what absence of
      anchors means forensically when full manifest verified.
      Is it always evidence of manipulation or are there
      legitimate cases where anchors are stripped — platform
      rendering, format conversion — without adversarial intent.
      Needs working group input before the flag can carry
      forensic weight.

- [x] Trailing whitespace normalization before hashing — LOCKED
      Strip rule: /[\r\n ]+$/ applied to visible text before
      text_hash and text_length are computed at signing time
      (manifestGenerator.mjs), and to extracted clean text before
      the received hash is computed at verification time
      (verificationTool.mjs). Both sides apply identically.
      Empirically derived from editor survival matrix collected
      July 7 2026 — 37 runs across 13 editors. Characters observed:
        U+000A \n — Google Docs automatic copy-out behavior
        U+0020 space — Word Browser automatic copy-out behavior
        U+0020 + U+000A — LinkedIn post and Instagram compose
          after user-typed trailing space
        U+0020 only — all other editors, user-typed trailing space
      No U+00A0 or U+000D observed. \r included as zero-cost
      conservative addition for untested Windows Word.

- [x] Canonical key generation command — LOCKED
      Private key must be generated using OpenSSL 3.x with
      the P-256 named curve. The generated key must use
      named-curve encoding (ASN1 OID: prime256v1 /
      NIST CURVE: P-256), which is compatible with
      Node.js crypto. Keys generated with LibreSSL that
      encode explicit EC parameters are not supported.

      Generation:
      openssl genpkey -algorithm EC \
        -pkeyopt ec_paramgen_curve:P-256 -out private.pem

      Verification:
      openssl pkey -in private.pem -text -noout

      Expected output includes:
      Private-Key: (256 bit)
      ASN1 OID: prime256v1
      NIST CURVE: P-256

  - [OPEN-3 — 2026-07-09] Span-array segment schema not defined. Current schema represents non-contiguous spans for a single segment as separate segment records. A span-array model — one segment record carrying multiple non-contiguous span ranges as an array — would reduce manifest size without losing attribution resolution. Must be defined in README.md before implementation. No decision adopted.

  - [OPEN-4 — 2026-07-09] Platform reclassification threshold for AI compose inputs not yet measured. Required before a production size ceiling can be locked. See §4.2.

  - [PENDING CROSS-CHECK] Code environment carrier scope — inline code
      block embedding excluded from v0.1. GitHub file-level preservation
      is scoped evidence only. No carrier mechanism for code blocks is
      defined. See §4.2.

  - [OPEN-6 — 2026-07-09] [PLANNED — PROPOSAL 005] Raw byte slice contract for chunk reconstruction. Chunk payloads must be treated as raw byte slices of the compressed manifest, never parsed into fields for re-encoding at reconstruction time. If confirmed, the canonicalization determinism problem across reconstruction is resolved. Confirmation required before chunkLayer.mjs design begins.

  - [OPEN-7 — 2026-07-09] Overwrite and re-signing contract undefined. See §4.

  - [HOLD-1 — 2026-07-09] Pre-005 chunked distribution without redundancy. Not motivated by current production data. Production manifests below 1,500 bytes do not produce latency problems at tested sizes. Hold until working group feedback on PROPOSAL 005 scope is received or a production latency problem is confirmed.

  - [HOLD] A.8R arbitrary-position embedding — wrapper-level research
      direction (see §4). No implementation, interoperability, or
      verifier contract is confirmed.
---

## 10. Change Log
The authoritative change record is CHANGELOG.md in the repository root. This section is not maintained. Do not add entries here.

## 11. Audit and Review History

### June 30 2026 — ES256 signature encoding conformance gap
Section 3 (Signing Layer) is marked SECURITY-CRITICAL. The
`algorithm` field declared `es256` from initial implementation,
but signingLayer.mjs used Node's default DER signature encoding
rather than the raw r‖s (IEEE P1363) encoding the ES256
identifier specifies. This was a label/format mismatch present
from initial build through external review on June 30 2026.
It was identified through external review, not through this
project's internal audit process — stated explicitly here for
accuracy. Fixed same day: dsaEncoding: 'ieee-p1363' added to
sign() and verify() calls. Verified through the existing internal regression suite (testSigning.mjs and testVerification.mjs) together with an independent primitive-level interoperability cross-check against the panva/jose library. Full envelope-level
(COSE_Sign1/JWS) interoperability remains unimplemented — see
Section 9.

Process note: the discovery scan for persisted old-format
signatures covered local *.json files only. It did not cover
the lps-certificates GitHub repository or markdown-embedded
example manifests in this repo or the proposal repository.
No migration was required for what was scanned. A wider scan
covering those locations is an outstanding action item.

### Outstanding — standards-conformance verification sweep
A systematic pass confirming every claimed conformance to an
external standard (C2PA, COSE, JOSE, RFC 3161, X.509, SHA-256)
has been independently tested, not merely asserted, has not yet
been performed. The ES256 encoding gap was caught by asking
about one specific claim; no equivalent check has been run
against the others. This sweep is required before working group
submission.

## REVIEW LOG

[RL-001] Section: §5 — Type: [VERIFIED] — Verified that [DEFINED — PROPOSAL 005] anchor_only appears exactly once as an output definition in §5. — Source: SPEC §5

[RL-002] Section: §4, §5, §8 — Type: [CORRECTED] — Added explicit [DEFINED — PROPOSAL 005] or [PLANNED — PROPOSAL 005] labels to PROPOSAL 005 output-state references so [DEFINED — PROPOSAL 005] anchor_only, [DEFINED — PROPOSAL 005] partial_recovery, [DEFINED — PROPOSAL 005] injection_detected, and [PLANNED — PROPOSAL 005] reconstruction_corrupted are never named without the required state label. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-003] Section: §4 — Type: [CORRECTED] — Replaced A.9-as-subject wording with an affirmative statement that the C2PA Text A.9 structured visible-text compatibility path remains outside v0.1 and PROPOSAL 005 A.8R scope. — Source: CHANGELOG 2026-07-07 A.9 removal

[RL-004] Section: §7 — Type: [VERIFIED] — Verified that "All dependencies pinned to specific versions" remains present and has no note block beneath it. — Source: SPEC §7

[RL-005] Section: §4.1 — Type: [FLAG] — Preserved CBOR binary encoding as [BUILT — NEEDS DATE CONFIRMATION]; CHANGELOG.md documents CBOR as a later optimization on 2026-06-20 but does not provide a confirmed built date. — Source: CHANGELOG 2026-06-20 Compression and capacity work

[RL-006] Section: §6 — Type: [CORRECTED] — Added the explicit qualifier that trust-list governance is "architecturally specified, not yet implemented in v0.1" so the production trust list is not implied to be implemented. — Source: CHANGELOG rule; SPEC §6

[RL-007] Section: §4.2 — Type: [VERIFIED] — Verified §4.2 is present and positioned between §4.1 and §5. — Source: SPEC §4.2

[RL-008] Section: Full spec — Type: [VERIFIED] — Verified CORRECTION LOG is absent. — Source: SPEC full-document scan

[RL-009] Section: §2 — Type: [CORRECTED] — Removed the bracketed removed-content marker from the spec body because it was changelog language rather than current specification behavior. — Source: SPEC §2

[RL-010] Section: §3 — Type: [CORRECTED] — Replaced deprecated-package wording with an affirmative current dependency rule: use @contentauth/c2pa-node only for embedding and do not use the original c2pa-node package. — Source: CHANGELOG 2026-07-06 Local survival-analysis rig moved to root pipeline

[RL-011] Section: §4 — Type: [CORRECTED] — Replaced "previous 256-byte ceiling assumption" changelog language with an affirmative current behavior statement: A.8 supports complex manifests by producing longer invisible payloads, with production limits governed by latency, reclassification, token overhead, and survival data. — Source: CHANGELOG 2026-07-06 Local survival-analysis rig moved to root pipeline; CHANGELOG 2026-07-08 Production cert_url and Appendix A live output

[RL-012] Section: §4.1 — Type: [CORRECTED] — Updated the Manifest Compression — Shortcode Dictionary section header from [DEFINED — v0.1] to [BUILT — 2026-07-03] because CHANGELOG.md confirms default omission/decompression behavior and shortcode/schema updates were brought into implementation alignment. — Source: CHANGELOG 2026-07-03 D.1–D.7 discrepancy audit fixes

[RL-013] Section: §8 — Type: [CORRECTED] — Updated Test Requirements from [DEFINED — v0.1 complete] to [BUILT — 2026-07-08] because CHANGELOG.md confirms all seven tests passing under production conditions. — Source: CHANGELOG 2026-07-08 Production cert_url and Appendix A live output

[RL-014] Section: §7 — Type: [VERIFIED] — Verified HMAC comparison, derived HMAC key material, magic-prefix validation, and injection-volume constraints in §7 carry [PLANNED — PROPOSAL 005]. — Source: SPEC §7

[RL-015] Section: §8 — Type: [VERIFIED] — Verified outstanding PROPOSAL 005 test coverage is marked not yet testable and labels [PLANNED — PROPOSAL 005] anchor_only, [PLANNED — PROPOSAL 005] partial_recovery, [PLANNED — PROPOSAL 005] injection_detected, and [PLANNED — PROPOSAL 005] reconstruction_corrupted. — Source: SPEC §8; CHANGELOG 2026-06 Proposal and research foundation

[RL-016] Section: §9 — Type: [CORRECTED] — Added [PLANNED — PROPOSAL 005] to Anchor manifest signing because anchor cryptographic verification belongs to the PROPOSAL 005 anchor model and is not implemented in v0.1. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-017] Section: §9 — Type: [CORRECTED] — Added [PLANNED — PROPOSAL 005] to c2pa-text chunk header exposure because chunk reconstruction belongs to PROPOSAL 005 and is not implemented in v0.1. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-018] Section: §9 — Type: [CORRECTED] — Added [PLANNED — PROPOSAL 005] to Injection volume cap formula because injection-volume enforcement belongs to the PROPOSAL 005 reconstruction layer and is not implemented in v0.1. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-019] Section: §9 — Type: [CORRECTED] — Added [PLANNED — PROPOSAL 005] to reconstruction_completeness threshold because low-confidence reconstruction is a PROPOSAL 005 partial-recovery constraint and is not implemented in v0.1. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-020] Section: §9 — Type: [CORRECTED] — Added [PLANNED — PROPOSAL 005] to anchor_layer: absent flag because anchor-layer semantics belong to PROPOSAL 005 and are not implemented in v0.1. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-021] Section: §9 — Type: [CORRECTED] — Added [PLANNED — PROPOSAL 005] to OPEN-6 raw byte slice contract because chunk reconstruction is a PROPOSAL 005 mechanism and is not implemented in v0.1. — Source: CHANGELOG 2026-06 Proposal and research foundation

[RL-022] Section: §9 — Type: [FLAG] — Left [NEEDS REVIEW: production constraints section not yet in SPEC] unchanged because the review instructions prohibit resolving any [NEEDS REVIEW] flag, although §4.2 is now present. — Source: SPEC §9; review instruction

[RL-023] Section: §9 — Type: [VERIFIED] — Checked open questions against CHANGELOG.md; no open item was converted to closed because the only stale-looking production-constraints note is protected by the [NEEDS REVIEW] preservation instruction. — Source: CHANGELOG full read

[RL-024] Section: §1.2 — Type: [CORRECTED] — Updated Confidence Fallback — Mathematical Derivation from [DEFINED — v0.1] to [BUILT — 2026-06-19] because CHANGELOG.md records the confidence fallback mechanism as added with the completed core pipeline. — Source: CHANGELOG 2026-06-19 Core pipeline completed
