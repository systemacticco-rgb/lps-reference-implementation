# LPS Reference Implementation — Technical Specification
Version: 0.1-draft
Status: Skeleton — sections marked [DEFINED], [PLACEHOLDER], [SECURITY-CRITICAL]

---

## 0. Principles
- Security above all other concerns
- One component per file, one concern per function
- No mixed responsibilities
- Audited libraries only — no custom cryptographic implementations
- Every function must be independently testable
- AI agents follow this spec exactly — no assumptions outside scope

---

## 1. Input Format [PLACEHOLDER]
What the manifest generator receives as input.
- Content: string (plain text for v0.1)
- Segments: array — start offset, end offset, origin type
- Origin types: "human" | "ai_generated" | "ai_modified_human"
- AI tool identifier: string
- Modification degree: float 0-1 (required for ai_modified_human only)
- Timestamp: ISO 8601

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
Algorithm: es256 (ECDSA P-256)
Library: @contentauth/c2pa-node (c2pa-node-v2, v0.5.4, March 2026)
Note: original c2pa-node deprecated September 2025 — do not use.
Key format: PEM
Certificate handling: self-signed for v0.1, CA-issued for production

Key storage v0.1: environment variable via .env file,
                  gitignored, never logged, never hardcoded.

Certificate generation command:
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 \
  -keyout private.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=lps-reference-implementation-v0.1"

private.pem — gitignored, never committed.
cert.pem — committed for v0.1 testing only.

Constraints:
- Never implement signing logic manually
- Key material never logged, never hardcoded, never in client-accessible variables
- Signing and verification are separate files, separate functions,
  zero shared mutable state
- SIGNING_ENABLED environment variable checked first in every
  signing function before any key access

---

## 4. Embedding Layer [DEFINED — infrastructure exists]
Library: encypherai/c2pa-text (MIT licensed)
Method for v0.1: Unstructured A.8 — Unicode Variation Selectors
Reason: survives copy-paste, sufficient for proof of concept
Fallback: Structured A.9 if manifest exceeds capacity constraint
Constraint: embedding and extraction are separate functions
Constraint: never modify content during embedding

Extraction output format: object with properties manifest (Uint8Array),
cleanText (string), offset (number), length (number).
Comparison must target extracted.manifest, not extracted directly.

Known limitation: Unicode variation selectors have data capacity ceiling.
Complex manifests with many segments may require fallback method.
Capacity threshold: [IN PROGRESS]
First data point — June 2026, component 0:
5-byte manifest occupies 26 Unicode characters after 37 visible characters.
Full threshold ceiling requires testing with larger manifests.

---

## 4.1 Manifest Compression — Shortcode Dictionary [DEFINED — v0.1]

All field names and origin values are shortened before embedding.
The verification tool expands them using this dictionary.
Dictionary is versioned and immutable — existing codes never change.
New codes may be added in future versions only.

### Field name codes — v0.1
lv   = lps_version
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

---

## 5. Verification Tool [PLACEHOLDER]
Input: file or text string with embedded manifest
Steps in order:
1. Extract manifest from content
2. Check signature against public key
3. Check certificate validity
4. Render contribution breakdown

Output — passing result: [TO BE DEFINED]
Output — failing result: [TO BE DEFINED]
Output — degraded result (partial signal): [TO BE DEFINED]

Constraint: verification never modifies the input
Constraint: certificate revocation check is mandatory,
           not optional — lesson from UMBC paper

---

## 6. Server-Side Record Store [PLACEHOLDER — component 4]
Architecture decision pending: foundation-hosted vs federated
Not required for v0.1 proof of concept
Required before working group submission

---

## 7. Security Constraints — Global [SECURITY-CRITICAL]
These apply to every component without exception:

- No cryptographic algorithm implemented from scratch
- No key material in logs, console output, or error messages
- No mixed concerns — each file has one job
- All dependencies pinned to specific versions
- All dependencies checked against known vulnerability databases
  before use
- Certificate revocation checking is mandatory
- Input validation on every entry point
- Error messages must not leak internal state

---

## 8. Test Requirements [PLACEHOLDER]
Each component requires:
- Unit test for expected input
- Unit test for malformed input
- Unit test for adversarial input (tampered manifest,
  invalid signature, stripped signal)
- Output must be deterministic for identical inputs

---

## 9. Open Questions — Blocking
These must be resolved before building the signing layer:
- [ ] Signing algorithm selection
- [ ] Key storage method for v0.1
- [ ] Capacity threshold for Unicode variation selectors
      [IN PROGRESS — first data point logged in section 4, June 2026]
- [ ] Passing/failing/degraded output format

---

## 10. Change Log
v0.1-draft — June 2026 — skeleton created
