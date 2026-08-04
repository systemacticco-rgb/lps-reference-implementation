# LPS Reference Implementation — Technical Specification
Version: 0.1-draft

This document mixes implemented behavior with forward-looking
architectural specifications. Every section must explicitly
identify whether it is Built, Defined, Planned, or Placeholder.

Status: [CURRENT AUDITED CONTRACT] v0.1 reference implementation. This
specification defines the current interface and behavioral contract for the
audited scope; it does not approve production deployment, governance, or
interoperability. Historical and proposal-only material below is subordinate to
the current contract where it differs.

---

## 1. Manifest input and confidence provenance [CURRENT AUDITED CONTRACT]

The manifest generator accepts visible text, segment information, a
`content_signed_at` source-record timestamp, and optional per-segment
confidence. Current origin values are `human`, `ai_generated`, and
`ai_modified_human`.

`confidence_source` has two current values:

```text
tool      = confidence supplied by the generating tool
fallback  = confidence calculated by LPS because confidence was absent
```

No classifier, human-reviewer, provider-attestation, or other `derived` source
is part of the current audited contract. A fallback value is an approximation,
not a forensic measurement or provider-origin assertion. The verifier returns
the confidence value together with `confidence_source`.

The locked confidence regression object is:

```js
{ ai_generated: 82, ai_modified_human: 15, human: 1 }
```

`confidence_source` is preserved through compression, embedding, and
verification. The current shorthand dictionary includes `csrc` for this field.

## 2. Manifest and envelope contract [CURRENT AUDITED CONTRACT]

The current contract separates the inner manifest from the authenticated outer
envelope:

```text
outer envelope
├── ev: 1
├── manifest
│   └── content_signed_at
└── signed_at
```

- `ev: 1` is a direct authenticated outer-envelope field. It selects the
  current envelope contract and does not require `FIELD_MAP.ev`.
- `content_signed_at` is inside the manifest and means the generating source's
  content-record signing or commitment time.
- Outer `signed_at` means when LPS signed the complete envelope.
- Both timestamps are authenticated. An inner `signed_at` is invalid.
- Missing, invalid, or unsupported `ev` yields `unsupported_version`; no
  default, legacy inference, or version remapping is allowed.

### Text-binding contract

The signer and verifier must apply the same sequence:

```text
visible text
→ strip trailing U+000D, U+000A, U+0020
→ UTF-8 bytes
→ SHA-256 text_hash and byte text_length
```

`text_hash` and `text_length` derive from the same canonical bytes and both
are checked. `text_length` is a byte length, not a character count and not
merely a failed-state disclosure value.

---

## 3. Signing Layer [SECURITY-CRITICAL]

The audited reference path validates a signed envelope, configured allowed HTTPS
certificate retrieval, and visible-text tamper detection. It does not establish
a final production cryptographic profile, certificate-trust governance, or
COSE, JOSE, C2PA, or other interoperability profile. The following is a
reference-implementation mechanism, not a standards-conformance claim.

**Algorithm**: es256 (internal LPS label for ECDSA P-256, SHA-256, raw r‖s)
Library: Node.js built-in crypto module (no install required)

**Signature encoding**: IEEE P1363 (raw r‖s, 64 bytes fixed for P-256).
  The JOSE identifier "ES256" uses raw r‖s bytes; COSE identifies
  the related primitive as algorithm -7. The LPS string es256 is neither
  of those standard identifiers and does not create a JOSE or COSE envelope.
  Node's default sign()/verify() output is DER — must explicitly pass
  { key, dsaEncoding: 'ieee-p1363' } to both createSign().sign()
  and createVerify().verify() calls. This implementation detail does not
  establish independent primitive, JWS, COSE, or envelope interoperability.
  
**Note**: c2pa-text is used in component 3 (embedding layer) only,
      not for signing. Signing uses native crypto exclusively.
      @contentauth/c2pa-node is listed in package.json but is
      not imported by the embedding layer directly.
      
**Note**: use @contentauth/c2pa-node only for the embedding layer.
      Do not use the original c2pa-node package.
      
**Key format**: PEM

**Certificate generation commands**:
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

Certificate delivery — audited reference scope:
cert.pem is not embedded in the manifest. It is hosted publicly at:
https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem
The manifest carries two fields instead:
cert_url — the configured allowed HTTPS retrieval route. The audited verifier
confirms this route, certificate fingerprint comparison, and signature
verification; it does not establish production certificate governance.
cert_fingerprint — SHA-256 hash of the certificate content.
The verification tool fetches the certificate, computes a SHA-256 hash of its DER-encoded bytes (X509Certificate.raw — not the PEM string), confirms it matches cert_fingerprint, then uses it to verify the signature. The signing layer computes cert_fingerprint the same way at sign time. Both sides must use DER bytes or the comparison is sensitive to PEM text encoding differences across platforms and network responses.
Repo: systemacticco-rgb/lps-certificates (public)

**Constraints**:
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

**Why not a C2PA media library for signing**:
@contentauth/c2pa-node is designed to sign media files — images,
video, audio. It embeds C2PA manifests into binary media containers.
LPS signs JSON text manifests, not media files. Node.js built-in
crypto signs any data format directly. No external dependency,
no binary compatibility risk, no version management required.
The embedding layer uses c2pa-text, a separate package handling
Unicode variation selector embedding for plain text. Signing and
embedding are separate concerns using separate tools.

HMAC/HKDF are not part of the audited current cryptographic profile. Any
future HMAC/HKDF design requires separate versioning, key hierarchy, key
identifiers, derivation parameters, storage, rotation, access policy, and
verification semantics. None of those production decisions are established
here.

---

## 4. Embedding Layer [BUILT — 2026-06-19]
Library: encypherai/c2pa-text (MIT licensed)
Method for v0.1: LPS selector carrier — legacy internal label A.8
Reason: [PENDING CROSS-CHECK] scoped copy/paste observations support
research use; transport preservation is not universal
Constraint: embedding and extraction are separate functions
Constraint: never modify content during embedding

[STANDARDS BOUNDARY] This component uses selector-carrier operations, but the
LPS output is not a C2PA A.8 wrapper. The documented v0.1 output lacks the
C2PA Manifest Store/JUMBF and C2PA COSE_Sign1_Tagged claim signature required
for that claim. PRE-3 must independently establish any statement about the
package's own C2PA behavior; package use does not establish LPS conformance.

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

[PENDING CROSS-CHECK] The c2pa-text selector operation can produce longer
invisible payloads for larger LPS manifests. Production limits depend on
external editor latency, platform reclassification, token overhead, and
transport preservation; the reference implementation does not establish a
production deployment claim.

The current v0.1 plain-text carrier is an LPS selector carrier. Any
structured visible-text carrier is outside the v0.1 pipeline and must not be
treated as a fallback. The legacy A.8 extraction label is the only
implementation route currently exposed. C2PA describes its selected variation
selectors as valid and visually non-rendering, so no generic Unicode
non-conformance is asserted. The relevant limitation is that LPS does not
emit the C2PA A.8/JUMBF/COSE structure; this says nothing about the validity
of LPS's cryptographic primitive.

[DEFERRED] Redundant embedding — PROPOSAL 005/A.8R — is post-feedback
research, not an independent system or C2PA Text A.9. No implementation or
pre-submission revision is authorized before working-group feedback. Its
paragraph copies, overlap, and reconstruction notes do not establish
transport survival or C2PA conformance.
Two new verification states defined for PROPOSAL 005:
[DEFINED — PROPOSAL 005] anchor_only and
[DEFINED — PROPOSAL 005] partial_recovery.
Chunk header format: seq uint16 + total uint16 + copy_id uint8
+ version uint8 = 6 bytes prepended to each A.8R chunk payload.

[HOLD] A.8R arbitrary-position embedding is a selector-wrapper research
direction: visible text would be split, an existing LPS selector operation
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

`ev` is not a dictionary field: it remains the direct authenticated outer
envelope version field. The dictionary must not add `FIELD_MAP.ev` or use a
shortcode/default rule to infer a missing `ev`.

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
sa   = signed_at (outer envelope)
m    = manifest
sig  = signature
cu   = cert_url
cfp  = cert_fingerprint
csrc = confidence_source
alg  = algorithm

### Algorithm field value convention [DEFINED — June 30 2026]
The `algorithm` field (shortcode `alg`) uses the internal string value `es256` to label the cryptographic primitive used in signing: ECDSA over the P-256 curve with `SHA-256` using `IEEE P1363` `r‖s` encoding. This is an LPS-internal naming convention and does not represent a `COSE` or `JOSE` algorithm identifier. In `COSE`, the equivalent algorithm is identified as `ES256` with integer value -7; in JOSE, the equivalent identifier is the string `"ES256"`. LPS does not currently implement either `COSE` or `JOSE` envelope format, and this specification defines no envelope-level interoperability profile.

### Origin value codes — v0.1
h    = human
aig  = ai_generated
aimh = ai_modified_human

### Version identifier codes — v0.1
lps-v0.1 = lps-reference-implementation-v0.1

### Version handling [CURRENT AUDITED CONTRACT]
`ev` is mandatory for the current envelope. It cannot be defaulted, inferred,
or replaced by an `lps_version` shorthand. Missing, invalid, or unsupported
`ev` returns `unsupported_version` before cryptographic verification.

### Confidence encoding [DEFINED]
Confidence stored as integer 0-100, not float 0.0-1.0.
Example: 0.95 stored as 95. Division by 100 on extraction
for display is specified but not implemented in v0.1 —
main-pipeline/verificationTool.mjs returns raw integers. Consumers should
expect integers in the range 0-100 from the current
implementation.
The normative confidence contract is defined in this section, not in a README.

### CBOR binary encoding [BUILT — 2026-06-20]
JSON serialization replaced with CBOR binary format.
Drops quotes from keys, encodes numbers as binary not text digits.
Estimated additional saving: 50-70% reduction in numeric field size.
Before decoder output is accepted for version routing, the verifier rejects
duplicate top-level envelope keys. A duplicate is
`invalid_envelope / noncanonical_encoding / present` and must not trigger
certificate retrieval, registry access, or fallback.

This implemented encoding path is not a complete normative canonical-CBOR
profile. Canonical-CBOR rules and decoder resource bounds remain deferred.

---
## 4.2 Scoped carrier observations [PENDING CROSS-CHECK]

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

## 5. Verification Tool [CURRENT AUDITED CONTRACT]

The verifier must not modify its input. It processes it in this order:

1. Classify the carrier as valid/parseable, absent, corrupted, or unparseable.
2. For a decoded envelope, reject duplicate top-level keys before version
   routing or external I/O.
3. For a valid, parseable carrier, validate `ev` and the envelope before
   certificate retrieval and cryptographic verification.
4. For a structurally valid supported envelope, use the configured allowed
   HTTPS certificate route, verify the certificate fingerprint and signature,
   then verify the canonical text hash and byte length.
5. Only for an absent, corrupted, or unparseable carrier, compute the canonical
   visible-text hash and perform exact-hash registry recovery.

### Result contract

`status` is mutually exclusive. `reason_code` is a stable machine-readable
cause; `carrier_condition` records the carrier boundary state.

| Status | Current reason behavior | Carrier condition |
|---|---|---|
| `verified` | No failure reason | `present` |
| `unsupported_version` | `missing_ev`, `invalid_ev`, or `unsupported_ev`, as applicable | `present` |
| `invalid_envelope` | `noncanonical_encoding` for a duplicate top-level key; `invalid_schema` for a parseable schema-invalid envelope; `malformed_envelope` for another parseable structural failure | `present` |
| `failed` | `signature_invalid`, `text_hash_mismatch`, or `text_length_mismatch`, as applicable | `present` |
| `registry_required` | `registry_match` | `absent`, `corrupted`, or `unparseable` |
| `degraded` | `registry_no_match`, `registry_unavailable`, or `registry_response_invalid` | `absent`, `corrupted`, or `unparseable` |

The carrier-condition terms mean:

```text
present     = a carrier and parseable envelope reached normal validation
absent      = no carrier was found
corrupted   = a carrier payload was damaged or incomplete
unparseable = carrier payload was recovered but cannot decode as an LPS envelope
```

`invalid_envelope` is never eligible for registry fallback. A registry match
corroborates only an exact canonical-text hash with a record; it does not
restore segment evidence, establish why a carrier is unavailable, authenticate
an issuer, or turn the result into `verified`.

Certificate issuer trust, revocation, rotation, lifecycle governance, and
production credential policy are outside this verification contract.
---

## 6. Registry recovery [CURRENT AUDITED CONTRACT]

The Supabase-backed registry is an exact canonical-text-hash recovery
mechanism. It is consulted only after an absent, corrupted, or unparseable
carrier—not for normal valid-carrier verification.

The registry response boundary is part of the contract:

```text
exact record       → registry_required / registry_match
no matching record → degraded / registry_no_match
transport/HTTP     → degraded / registry_unavailable
malformed/incomplete response
                   → degraded / registry_response_invalid
```

The implementation validates recovery responses before using them. A match
corroborates an exact canonical-text hash with a record and nothing more: it
does not restore span-level evidence, prove carrier removal, establish
authorship or provider origin, or serve as issuer authentication.

`generating_id` has minimal safety validation only. This specification does
not define its identity, authorization, provider, issuer, or trust semantics.

Registry SLOs, monitoring, retry policy, incident response, rollback,
credential isolation, access governance, retention, and identity policy are
production-only follow-ups. No such operational behavior is established by the
audited reference implementation.
---

## 7. Security Constraints — Global [SECURITY-CRITICAL]

- Do not implement cryptographic primitives from scratch or expose key material
  in logs, errors, or client-accessible configuration.
- Treat the visible text, carrier, decoded envelope, certificate response, and
  registry response as untrusted until the applicable validation boundary
  completes.
- Reject duplicate top-level envelope keys before version routing or any
  external I/O. Do not use registry recovery for a parseable invalid envelope.
- Do not represent certificate fingerprint and signature verification as issuer
  authorization, certificate revocation checking, or certificate governance.
- Treat test-only keys and dotenv use as test evidence only; they do not
  establish production key custody, credential isolation, or credential policy.
- Do not represent a registry record as provider-origin authentication,
  authorized-issuer verification, or a substitute for a valid carrier.
- HMAC/HKDF, a complete canonical-CBOR profile, decoder resource bounds, and
  broader cryptographic-profile choices remain deferred.
---

## 8. Validation evidence [CURRENT AUDITED SCOPE]

The audit confirms assertion-backed integration, manifest, embedding,
confidence, signing, and verification coverage. `test/pipeline-contract.integration.test.mjs`
completed 12 assertion-backed checks for the locked envelope, registry,
malformed-carrier, and failure contracts. The stale confidence, signing, and
verification tests were corrected and are assertion-backed.

Runtime evidence also confirms:

- an allowed HTTPS certificate retrieval path with fingerprint and signature
  verification;
- visible-text tamper detection returning `text_hash_mismatch`;
- read-only live exact-match registry recovery; and
- read-only live no-match registry recovery.

This is implementation evidence only. It does not establish C2PA, SynthID,
COSE, JOSE, certificate-governance, provider, issuer, production operations,
or deployment conformance. [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
owns the evidence-oriented summary and limitations.

## 9. Historical and proposal references [NON-NORMATIVE]

Sections 1–8 define the current audited contract. Historical change and review
records are maintained in [`CHANGELOG.md`](CHANGELOG.md), and current audit
evidence is maintained in [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

Proposal-only material does not amend this specification: see
[`PROPOSAL_005.md`](PROPOSAL_005.md) for Proposal 005 and
[`proposals/PROPOSAL_007.md`](proposals/PROPOSAL_007.md) for Proposal 007.
Neither proposal establishes a current LPS envelope, registry, trust, or
production claim.

### Proposal 007 testing-tool evidence [NON-NORMATIVE]

Proposal 007 has a separate cooperative-marker testing-tool grammar and result
catalog. The following 2026-07-31 observations are recorded for that tool;
they neither add fields to this specification nor replace the LPS status,
`reason_code`, or `carrier_condition` contract in Sections 2–6.

| Testing-tool case | Observed result | Required testing-tool result |
|---|---|---|
| Firefox/Linux hold-and-drag copy/paste | 100% marker survival in the tested flow | Valid |
| Firefox/Linux double-click copy/paste | 100% marker survival; no trailing space observed | Valid |
| Tested BiDi-language content | 100% marker survival despite highlighting glitches | Valid |
| Malformed sequence | Correct rejection | `E-0-0-2: INVALID_TYPE` |
| Duplicate header | 100% survival; correct rejection at normalized index `5` | `E006: DUPLICATE_HEADER` |
| Orphaned open marker | Correct rejection at normalized index `5` | `E-007: ORPHANED_OPEN` |
| Orphaned close marker | Correct rejection at normalized index `34` | `E-008: ORPHANED_CLOSE` |
| Trailing normalization | Correct behavior; 100% marker survival | Valid |
| Internal codepoints | 100% survival; correctly detected | `E-009: INTERNAL_SIGNAL` |

For that testing tool, headers are document-scoped and the embedding tool must
support different header sizes. Lens 200 remains undefined and limited to
testing-tool scope. Human spans, per-span ordinals, and per-span total-count
fields are excluded from the current direction. Internal codepoints within a
valid marker context use the internal-signal path. The listed error identifiers
and normalized indexes remain fixed testing-tool expectations unless a
separately approved error-catalog change is made.

#### ADR 2 marker/header record [NON-NORMATIVE]

[`ADR_2`](ADR_2) is a proposed Proposal 007 testing-tool design record. It
defines an AI-only model with one document-scoped base-5 total-count header;
the resulting count-level signal cannot localize ordinal gaps or retain the
former human-marker selective-stripping observation. It also records the
approved U+2060–U+2064 library, normalized-codepoint scan model, and a detailed
tool error catalog. None of those rules adds an LPS v0.1 field, carrier route,
or verification result.

The ADR 2 catalog and later observed testing-tool output labels are not an LPS
error namespace and must not be treated as interchangeable without an approved
Proposal 007 catalog reconciliation. This specification therefore preserves the
recorded testing-tool observations above without assigning them normative LPS
semantics.

#### ADR 3 cross-transport record [NON-NORMATIVE]

[`ADR_3`](ADR_3) separately records route-specific Proposal 007 observations
from messenger, web/social, AI-client, editor, mobile-browser, and clipboard
paths. A reported survival result means only that the testing-tool verifier
found valid signals after the named route. The Facebook Web composer/post
difference and observed selection-dependent trailing U+0020 are received-input
observations, not evidence assigning a mutation cause. Absence of a valid
signal, including a no-valid-signal result where applicable, does not establish
stripping, provenance, authorship, or service behavior.

These observations are not a claim of universal transport compatibility or
invisibility. They do not resolve the source of trailing spaces in other
clipboard paths, prove that BiDi highlighting cannot alter selection boundaries
or codepoint order, or define production marker grammar, placement, fallback,
or injection controls. The 2026-07-31 local-test evidence and open-question
record is in [`local-files/ADR_4`](local-files/ADR_4); ADR 3 is a separate
cross-transport record rather than part of that later local-test dataset.
