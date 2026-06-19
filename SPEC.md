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
Algorithm: es256 (ECDSA P-256)
Library: Node.js built-in crypto module (no install required)
Note: @contentauth/c2pa-node is used in component 3 (embedding
      layer) only, not for signing. Signing uses native crypto
      exclusively.
Note: original c2pa-node deprecated September 2025 — do not use.
Key format: PEM
Certificate generation commands:
openssl ecparam -name prime256v1 -genkey -noout -out private_raw.pem
openssl req -new -x509 -key private_raw.pem -out cert.pem -days 365 \
  -subj "/CN=lps-reference-implementation-v0.1" \
  -addext "subjectKeyIdentifier=hash" \
  -addext "authorityKeyIdentifier=keyid:always" \
  -addext "basicConstraints=critical,CA:FALSE"
openssl pkcs8 -topk8 -nocrypt -in private_raw.pem -out private.pem
rm private_raw.pem

private.pem — gitignored, never committed.
cert.pem — committed for v0.1 testing only.

Constraints:
- Never implement signing logic manually
- Key material never logged, never hardcoded, never in client-accessible variables
- Signing and verification are separate files, separate functions,
  zero shared mutable state
- SIGNING_ENABLED environment variable checked first in every
  signing function before any key access

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
