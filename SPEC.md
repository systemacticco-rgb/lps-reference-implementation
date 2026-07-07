# LPS Reference Implementation — Technical Specification
Version: 0.1-draft
This document mixes implemented behavior with forward-looking
architectural specifications. Every section must explicitly
identify whether it is Built, Defined, Planned, or Placeholder.
Status: Skeleton — sections marked [DEFINED], [PLACEHOLDER], [SECURITY-CRITICAL]

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

## 1.2 Confidence Fallback — Mathematical Derivation [DEFINED — v0.1]

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

### Shortcode — section 4.1 addition required
confidence_source is a new manifest field not present in the
v0.1 shortcode dictionary. Add the following entry to section 4.1
before implementing:

  csrc = confidence_source

### Code changes required
generateManifest() in manifestGenerator.mjs must be updated to:
1. Accept optional confidence per segment.
2. Detect absence of confidence and run the fallback calculation.
3. Write confidence_source on every segment in the output.
The fallback calculation runs after all segments are mapped,
using the totalCharCount, aiCharCount, and humanCharCount
values already computed for proportion calculation.



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

## 2.1 Component Understanding — Read Before Building

### What are the three origin types and what does each mean?
Human: written entirely by a human, no AI involvement at any stage.
AI generated: written entirely by an AI tool, no human wrote
the original text.
AI modified human: a human wrote it first, then an AI edited,
rewrote, or transformed it. Both were involved. The modification
degree field records how much the AI changed it — 0.1 means barely
touched, 0.9 means almost completely rewritten.

### What is a segment and what two pieces of information define
its boundaries?
A segment is one contiguous section of the text with a single
origin type. It is described in the manifest by two coordinates
— start_offset and end_offset — which are character position
numbers pointing into the visible text. Start offset is the
position of the first character of that section. End offset is
the position of the last character. The text itself is untouched.
The manifest holds the map.

### What is the confidence field and what does 0.95 mean vs 0.60?
The confidence field records how certain the system is about
the origin classification assigned to that segment. 0.95 means
95% confident — the signal was clear, the classification is
strong. 0.60 means 60% confident — the signal was weak or
ambiguous. For forensic contexts this matters significantly.
A judge treats a segment classified as AI generated at 0.95
differently from the same classification at 0.60.

### What is overall_ai_proportion and where does it come from?
The percentage of total content touched by AI in any way —
either fully generated or modified. Calculated from segment
boundaries: sum of characters in AI generated and AI modified
human segments divided by total characters in the document.
human_proportion is the inverse. Both are calculated automatically
by the manifest generator from the segment data. They always
add up to 1.0.

### What does the manifest generator receive as input and
what does it produce as output?
Input: a list of segments each with start offset, end offset,
origin type, AI tool identifier if relevant, modification degree
if relevant, and confidence value. Plus signing tool name and
timestamp.
Output: one JSON object — the manifest — structured exactly
according to the schema in README.md section 3.2.
It does not sign anything. It does not embed anything.
One job: structured input in, structured JSON out.

### Where is the schema definition to follow before writing
any code?
README.md section 3.2 in the proposal repository:
https://github.com/systemacticco-rgb/linguistic-provenance-schema
#32-what-lps-records
Schema changes happen in README.md first.
SPEC.md and code follow. README.md is the authority.

### What does the signing layer do to the manifest?
The manifest generator produces a JSON object. It is plain
readable text with no protection — anyone could open it and
change a value. The signing layer seals it. It takes the manifest
JSON, converts it to bytes, and passes it through ECDSA P-256
using your private key. The output is a signature — a unique
string that could only have been produced by combining that exact
manifest with that exact private key. Change one byte in the
manifest after signing and the signature no longer matches.
Verification fails. The signing layer never touches the visible
text. It only touches the manifest.

### What are the two keys and what does each one do?
Private key: signs the manifest. Only you have it. Never committed
to GitHub. Never logged. Lives in .env file locally and in Vercel
environment variables for deployment. Generated once using OpenSSL.
Public certificate: verifies the signature. Anyone can have it.
Committed to the repo. A verifier uses it to confirm the signature
is valid without ever needing access to the private key.
Two separate jobs. Two separate files. One never leaves your
machine. The other is public by design.

### What is the order of operations across all four components?
1. Manifest generator produces JSON manifest from segment data.
2. Signing layer signs that JSON using private key —
   produces signed manifest.
3. Embedding layer takes signed manifest and embeds it into
   the text as invisible Unicode variation selectors.
4. Verification tool extracts manifest from text, checks
   signature against public certificate, renders breakdown.
The text and the manifest are two separate things throughout.
The signing layer sits between the manifest generator and the
embedding layer. It seals the manifest before it enters the text.

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
Note: @contentauth/c2pa-node is used in component 3 (embedding
      layer) only, not for signing. Signing uses native crypto
      exclusively.
Note: original c2pa-node deprecated September 2025 — do not use.
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
cert_url — the public URL of the certificate.
cert_fingerprint — SHA-256 hash of the certificate content.
The verification tool fetches the certificate, hashes it, confirms it
matches cert_fingerprint, then uses it to verify the signature.
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

  Why not @contentauth/c2pa-node for signing:
@contentauth/c2pa-node is designed to sign media files — images,
video, audio. It embeds C2PA manifests into binary media containers.
LPS signs JSON text manifests, not media files. The library cannot
sign arbitrary JSON without a media file wrapper. Node.js built-in
crypto signs any data format directly. No external dependency,
no binary compatibility risk, no version management required.
@contentauth/c2pa-node is used in component 3 (embedding layer)
only. Signing and embedding are separate concerns using separate
tools.

HMAC key derivation for anchor manifests: [PLANNED — pending key
hierarchy lock]
HKDF-SHA256 confirmed as the primitive, replacing the earlier
createSign-based draft shown in prior versions of this section —
see PROPOSAL 005 "HMAC key derivation." Derived using Node's
built-in crypto.hkdfSync('sha256', ikm, salt, info, 32). No
external dependencies. Consistent with no-external-crypto
constraint. ikm, salt, and info are NOT YET DEFINED — locked
together as one decision covering root keying material, whether
anchor keys derive from the signing key or a separate master
secret, and how future keys (registry, token, rotation) extend
the hierarchy without rework. This section is rewritten once with
final values once that decision locks, then treated as immutable —
same rule as the shortcode dictionary.

---

## 4. Embedding Layer [DEFINED — infrastructure exists]
Library: encypherai/c2pa-text (MIT licensed)
Method for v0.1: Unstructured A.8 — Unicode Variation Selectors
Reason: survives copy-paste, sufficient for proof of concept
Constraint: embedding and extraction are separate functions
Constraint: never modify content during embedding

Extraction output format: object with properties manifest (Uint8Array),
cleanText (string), offset (number), length (number).
Comparison must target extracted.manifest, not extracted directly.

Known limitation: larger manifests create longer invisible wrapper
sequences, which may reduce editor survival in practice. This is an
operational survival constraint, not an embedding-layer fallback trigger.
Capacity threshold: [DEFINED — June 2026]
First data point — component 0:
5-byte manifest occupies 26 Unicode characters after 37 visible characters.

Production measurement — 5-segment manifest after full compression pipeline:
Raw JSON with certificate:              2026 bytes
After certificate removal:              1219 bytes
After shortcode compression:             843 bytes
After CBOR encoding:                     737 bytes
Former assumed ceiling:                  256 bytes

Conclusion: the previous 256-byte ceiling assumption does not apply to
the `c2pa-text` A.8 wrapper implementation. Complex manifests remain
testable through A.8, but produce longer invisible payloads and need
manual survival data from target editors.
Remaining optimization target: cert_url shortcode registry — drops
78-byte URL to 3-4 bytes. Reserved for v0.2.

Structured A.9 compatibility path:
Structured A.9 stores manifest bytes or references in a delimited
`data:application/c2pa;base64,...` block using host comment
syntax. It is visible plain text and is therefore not the default
plain-text survival-test carrier.

Detection: verificationTool.mjs first tries A.8 extraction via
extractManifest(), then tries A.9 structured extraction via
extractStructured(). No flag is required in the manifest. The
verification result reports embedding_method_used as A.8 or A.9.

Redundant embedding — PROPOSAL 005 — post-v0.1
One complete full manifest copy embedded per paragraph via A.8R,
an A.8-derived redundant invisible variation-selector chunk carrier.
A.8R is not C2PA Text A.9; A.9 remains a structured visible-text
compatibility path only. A.8R copies overlap by 25% of chunk range.
Cross-copy reconstruction via seq number grouping. See PROPOSAL 005
for full architecture.
Two new verification states defined: anchor_only, partial_recovery.
Chunk header format: seq uint16 + total uint16 + copy_id uint8
+ version uint8 = 6 bytes prepended to each A.8R chunk payload.

---

## 4.1 Manifest Compression — Shortcode Dictionary [DEFINED — v0.1]

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
Example: 0.95 stored as 95. Verification tool divides by 100
on extraction for display purposes.
Defined in README.md section 3.2 as authoritative.

### v0.2 optimization — CBOR binary encoding [PLANNED]
JSON serialization replaced with CBOR binary format.
Drops quotes from keys, encodes numbers as binary not text digits.
Estimated additional saving: 50-70% reduction in numeric field size.
Do not implement until shortcode dictionary is tested in v0.1.
Requires verification tool update to deserialize CBOR on extraction.
Status note: this optimization has not been implemented and
must not be assumed by any component until both serialization
and verification paths are updated together.

---

## 5. Verification Tool [DEFINED — commit 4 files, June 19 2026]
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
  Returns: status, signed_at, algorithm, overall_ai_proportion,
  human_proportion, segments array with full breakdown.

Output — failed: signal found but signature invalid, or visible
  text hash does not match. Returns: status, reason, signed_at,
  algorithm.

Output — degraded: signal absent or corrupted. Returns: status,
  reason, anti_forensic_note.

Output — registry_required: signal absent, registry lookup
  succeeded. Returns: status, reason, registry_record with
  token, content_hash, generating_id, created_at.
  Implemented in v0.1 stub — registryClient.mjs.
  Full production architecture: PROPOSALS.md PROPOSAL 001.

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

Output — anchor_only: no full manifest recoverable, anchor
  manifests present. Returns: text_hash, overall_ai_proportion,
  human_proportion, algorithm, signed_at. No segment breakdown.
  No signature verification.

Output — partial_recovery: manifest partially reconstructed
  from cross-copy surviving chunks. Returns: reconstructed
  fields, missing seq positions list, reconstruction map.
  Signature verification did not run.

Output — injection_detected: conflicting certificates found
  across chunk assemblies. Returns session certificate
  fingerprint and injected certificate fingerprint.

Output — anchor_only: updated to note anchor HMAC validation
  required before anchor fields are trusted. Anchors failing
  HMAC are discarded before fallback decision.

  anchor_layer: present | absent | conflict

Output — injection_detected: valid chunks found from multiple
  certificate sources during reconstruction. Session certificate
  anchor established from first valid assembly. Subsequent
  assembly produced different cert_url or cert_fingerprint.
  Returns: status, session_cert_fingerprint,
  injected_cert_fingerprint, signed_at from session manifest.
  Forensic value: active adversarial injection attempt recorded
  with both certificate fingerprints as evidence.

[BUILT — v0.1] original_manifest disclosure in the failed state
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

Architecture defined in PROPOSALS.md PROPOSAL 001.

A functional registry stub exists in the v0.1 reference
implementation (registryClient.mjs), providing registration
and lookup by token and content hash for demonstration and
testing purposes.

The full production architecture—including trust-list
governance, credential management, certificate lifecycle,
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
Tiered read access. Not public. Read access requires
credentialed authority — legal, governmental, or institutional.
Consumer layer has no access. This is intentional.

### Forensic value
The only verification layer that survives transcription,
screenshot, and signal stripping. Not proof of authorship.
Corroborating forensic evidence for legal proceedings.

### Why it is deferred
Hash must be written at generation time, server-side, by the
model provider. Cannot be retrofitted by a third party.
Google, Anthropic, OpenAI, Meta must integrate this at the
generation layer. Adoption requires regulatory mandate or
voluntary commitment from providers.

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

### Connects to
PROPOSAL 001 — Notarization Registry
PROPOSAL 002 — Server-Side Token Binding
RESEARCH 002 — Legal Framework for Cross-Registry Access

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
- Rate limit: maximum registrations per generating_id per hour.
  Reject inserts exceeding the limit with a thrown error.
  Threshold open — see Section 9.
- All three controls applied before Supabase insert runs.
  Supabase is never called on invalid input.
---

## 7. Security Constraints — Global [SECURITY-CRITICAL]
These apply to every component without exception:

- No cryptographic algorithm implemented from scratch
- No key material in logs, console output, or error messages
- No mixed concerns — each file has one job
- All dependencies pinned to specific versions
[NOTE — 2026-07-05] "Pinned" currently means lockfile-enforced
  (package-lock.json resolves every dependency, including cbor, to
  one exact version with an integrity hash), not package.json
  version-string pinning (package.json still uses caret ranges).
  This distinction matters specifically for cbor: canonical byte
  output from compression.mjs's canonicalBytes() must stay
  bit-identical for a given manifest forever, or old signatures stop
  verifying. See SECURITY_MODEL.md "Security assumptions" for the
  full risk and why the obvious fixes (freeze the encoder vs. tag the
  manifest with an encoder version) are both currently deferred.
- All dependencies checked against known vulnerability databases
  before use
- Certificate revocation checking is mandatory
- Input validation on every entry point
- Error messages must not leak internal state
- HMAC comparison must use crypto.timingSafeEqual() —
  never standard equality. Applies to all HMAC verification
  operations in the codebase without exception.
- Derived HMAC key material is sensitive. Never logged,
  never returned in error messages, never stored. Same
  handling rules as private key material.
- Magic prefix secondary validation mandatory — type field
  must be 0 or 1, version must be 1, total must be greater
  than 0. Buffers failing secondary checks discarded
  without further parsing.
- Injection volume cap applied before reconstruction begins.
  Cap formula open — see Section 9.
---

## 8. Test Requirements [DEFINED — v0.1 complete]
Each component has a dedicated test file.
All tests pass as of June 20 2026.

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
Tampered visible text — returns failed with original_manifest.
Certificate fingerprint mismatch — returns failed.
Missing signal — returns degraded with anti_forensic_note.
Corrupted signal — returns degraded.

### Outstanding test gaps
- Malformed CBOR input to verificationTool.mjs
- A.9 structured extraction path — removed. A.8 is the only
  extraction path in verificationTool.mjs as of July 7 2026.
  Closed OPEN-1.
- Certificate fetch failure — network unavailable scenario
- Chain depth test — not applicable until multi-round
  provenance is implemented
- PROPOSAL 005 overlap reconstruction — not yet tested
- anchor_only state — not yet tested
- partial_recovery state — not yet tested
- Cross-copy seq deduplication logic — not yet tested
- [Closed 2026-07-04] Replay attack detection — failed state
  with extreme text length mismatch must not return
  original_manifest. Confirmed passing in testVerification.mjs
  (18% delta case). See CHANGELOG.md 2026-07-04 (7:31pm) entry.
- injection_detected state — conflicting certificates
  across chunk assemblies.
- anchor_layer: absent flag — verified manifest with
  no surviving anchors.
- HMAC timing safety — verify crypto.timingSafeEqual()
  used in all comparison paths.x
- Registry input validation — invalid hash format,
  invalid generating_id format, rate limit enforcement.
- Chunk 001 extended payload — verify 40-byte slice
  handled correctly through full embed and extract cycle.
- reconstruction_completeness below 50% threshold —
  low_confidence_reconstruction flag present in output.
- paragraphAnalysis merge decisions — verify merge map
  present in distribution plan and surfaced in output.
- Magic prefix secondary validation — buffers passing
  magic prefix but failing secondary checks discarded.
- injection_volume_exceeded flag — document with
  anomalous buffer count handled correctly.

---

## 9. Open Questions — Blocking
These must be resolved before building the signing layer:
- [ ] Signing algorithm selection —  DEFINED, ES256 ECDSA P-256
- [ ] Key storage method for v0.1
- [ ] Capacity threshold for Unicode variation selectors
      [IN PROGRESS — first data point logged in section 4, June 2026]
- [ ] Passing/failing/degraded output format —  DEFINED, JSON, four states
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
      References: SPEC.md [H1], [H2], [H3] from proposal repo.
      [OPEN — post-v0.1, pre-working-group-submission]
      
- [ ] Minimum document length requirement for paragraph-bound
      copy model — total payload size must be profiled before
      implementation. Short documents may not have sufficient
      characters to carry one full copy per paragraph.
- [ ] Anchor manifest signing — deferred to v0.2. Unsigned
      anchors are forensically useful but not cryptographically
      verifiable independently.
- [ ] c2pa-text chunk header exposure — extraction output
      must expose chunk headers for reconstruction logic.
      May require implementation above c2pa-text layer.
- [x] Minor mismatch threshold for original_manifest disclosure
      in failed state — LOCKED at 10% text length difference,
      implemented in verificationTool.mjs. Revisit if forensic
      or legal input post-submission indicates 10% is too tight
      (leaks provenance) or too loose (withholds forensically
      valuable information).

- [ ] Injection volume cap formula — paragraphCount ×
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

- [ ] reconstruction_completeness threshold for
      low_confidence_reconstruction flag — 50% proposed.
      Below this threshold the partial breakdown may mislead
      more than it informs. Needs forensic input on minimum
      viable segment coverage for a report to be admissible.

- [ ] anchor_layer: absent flag — defines what absence of
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
      Closes OPEN-2.
      
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
---

## 10. Change Log
v0.1-draft ## 10. Change Log
v0.1-draft — June 2026 — skeleton created
v0.1-registry-stub — June 21 2026 — registry stub implemented.
  Added: registryClient.mjs, testRegistry.mjs,
  testRegistryVerification.mjs. Updated: verificationTool.mjs
  registry_required state wired. Supabase tables created:
  registry_records, usage_events. All six tests passing.— June 2026 — skeleton created
v0.1-cose-fix — June 30 2026 — corrected ES256 signature encoding.
  signingLayer.mjs and verificationTool.mjs updated to use
  dsaEncoding: 'ieee-p1363' instead of Node's default DER
  encoding. Closes a label/format mismatch where the algorithm
  field claimed es256 (which specifies raw r‖s) while actual
  signature bytes were DER-encoded, variable length ~70-72 bytes.
  Fixed signatures are now exactly 64 bytes, fixed length, for
  P-256. Verified via internal test suite and an external
  cross-check against the independent jose library (panva/jose),
  confirming primitive-level ES256 signature encoding compatibility
  rather than internal-only self-consistency. Full JWS/COSE_Sign1
  envelope interoperability remains unimplemented. No persisted
  signed manifests existed at time of fix — no migration required.
  ---

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
