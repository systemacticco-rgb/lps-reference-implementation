# LPS Reference Implementation

**Repository:** lps-reference-implementation (private)

**Maintained by:** Brayan Daniel Rodriguez Lugo — systemacticco-rgb

**Status:** v0.1 — audited reference pipeline; not production approval

**Counterpart (public):** github.com/systemacticco-rgb/linguistic-provenance-schema

**Document revision:** V3 — Proposal 007 ADR 2/ADR 3 evidence alignment, 2026-08-03

**Session-log alignment:** standards-boundary remediation, 2026-07-29

---

## What This Repository Is

This is the private implementation repository for the Linguistic Provenance Schema (LPS). It contains the working reference implementation, the internal technical specification, architecture and security documentation, and the changelog. It is not the public-facing proposal. That lives in the public repository above.

For the audited current-state scope, the standalone current-state ADR controls
conflicting historical conclusions. [`SPEC.md`](SPEC.md) owns the normative
interface and behavioral contract; this README owns repository orientation.
If code and documentation disagree, record and resolve the discrepancy rather
than choosing whichever source is more convenient.

---

## Who This Repository Is For

Internal use only. This repository is read by:
- Build agents (Claude Code, Opus) executing implementation tasks
- The author auditing outputs and making architectural decisions
- Future collaborators brought in under explicit agreement

It is not distributed to the C2PA working group. It is not the submission
artifact. The public repository handles that. If a working group reviewer
requests deeper implementation detail, the correct response is a purpose-built
distilled document — not sharing this repository as-is.

---

## Repository Structure

```
lps-reference-implementation/
├── main-pipeline/
│   ├── manifestGenerator.mjs      Stage 1 — manifest generation
│   ├── signingLayer.mjs           Stage 2 — ECDSA P-256 signing
│   ├── embeddingLayer.mjs         Stage 3 — Unicode carrier embedding
│   ├── verificationTool.mjs       Stage 4 — extraction and verification
│   ├── compression.mjs            Shortcode compression + CBOR encode/decode
│   ├── registryClient.mjs         Supabase registry stub (register + query)
│   └── confidenceFallback.mjs     Mathematical fallback confidence derivation
├── test/
│   ├── pipeline-contract.integration.test.mjs  Pipeline contract integration test
│   ├── testConfidenceFallback.mjs Fallback confidence calculation test
│   ├── testDegraded.mjs           Degraded-result test
│   ├── testEmbedding.mjs          Stage 3 test
│   ├── testManifest.mjs           Stage 1 test
│   ├── testRegistry.mjs           Registry registration and query test
│   ├── testRegistryValidation.mjs Registry validation test
│   ├── testRegistryVerification.mjs registry_required state test
│   ├── testSigning.mjs            Stage 2 test
│   ├── testVerification.mjs       Stage 4 test
│   ├── lps-local-test-server.mjs  Local editor survival-analysis rig
│   └── test-proposal-007-markers.html Proposal 007 marker test tool
├── cert.pem                      Public certificate (v0.1 testing only)
├── private.pem                   Private key — GITIGNORED, never committed
├── .env                          Environment variables — GITIGNORED
├── SPEC.md                       Internal technical specification (this repo)
├── ARCHITECTURE.md               System architecture and component map
├── SECURITY_MODEL.md             Trust boundaries, threat model, key handling
├── IMPLEMENTATION_STATUS.md      What is built, what is specified, what is open
├── DIAGRAMS.md                   Visual system diagrams
└── CHANGELOG.md                  Versioned change history
```

---

## Document Authority Map

Before reading or editing anything, know which document owns which kind of
truth. Conflicts between documents are bugs. The resolution order is:

| Question | Authoritative source |
|---|---|
| What is the current normative interface and behavioral contract? | SPEC.md (this repo) |
| How should a build agent implement a component? | SPEC.md, ARCHITECTURE.md, and SECURITY_MODEL.md (this repo) |
| What is the current build status of each component? | IMPLEMENTATION_STATUS.md |
| What cryptographic decisions are locked vs open? | SECURITY_MODEL.md |
| What changed and when? | CHANGELOG.md |
| How do the components connect as a system? | ARCHITECTURE.md |
| What does the system look like visually? | DIAGRAMS.md |
| What is proposed but not yet built? | PROPOSAL_005.md in this repository |

Do not change the schema in code first. Update the normative contract and its
implementation evidence together, then use the public README and working-group
submission as orientation and reviewer-facing material rather than parallel
schema authorities.

---

## Standards-Conformance and Deferred-Work Boundary

Treat PRE-3 as pending, bounded verification work—not as permission to make
new standards or architecture claims. Before external wording is expanded,
PRE-3 must inventory each C2PA, COSE, JOSE, RFC 3161, X.509, SHA-256,
signature, certificate, canonicalization, and validation claim; map it to an
exact normative reference; independently test it; and record supported,
unsupported, incomplete, or out-of-scope status. Required artifacts are the
claim-to-standard matrix, exact version references, test-vector or
independent-parser results, deviations/non-claims, and a remediation list.

The current LPS text carrier is a selector-based LPS JSON/native-crypto
format. It is not a C2PA A.8 implementation: the documented implementation
does not emit the C2PA A.8 wrapper's C2PA Manifest Store in JUMBF or a C2PA
COSE_Sign1_Tagged claim signature. Do not call this workflow C2PA-compatible,
and do not collapse the internal trailing-whitespace strip rule into C2PA
data-hash validation. The latter has different NFC UTF-8 and wrapper-offset
requirements.

The primary selector-carrier submission decision is closed as an internal
portfolio decision. It does not create C2PA A.8 conformance or close PRE-3.

Certificate fingerprint checking is implemented behavior; a C2PA certificate
status or OCSP result is not. Any future revocation policy is an LPS design
choice. C2PA's allowance for skipped online OCSP checks must not be rewritten
as a mandatory C2PA revocation requirement.

Proposal 005 is deferred until working-group feedback; do not build or
pre-submit revise it. Proposal 006 remains under review and is inactive until
after submission. The audited registry supports only exact-hash recovery;
formal provider, issuer, and `generating_id` identity semantics, any future
identifier grammar, and their governance remain deferred.

---

## Document Summaries

### SPEC.md
The internal build specification. It defines the current audited contract as
well as clearly labelled historical and deferred material. Current contract
sections are marked `[CURRENT AUDITED CONTRACT]`; other labels distinguish
built implementation details from deferred or historical notes. It is not a
working-group submission.

### ARCHITECTURE.md
Describes how the four pipeline stages connect — manifest generation, signing, embedding, verification — and how the registry, certificate store, and compression layer fit within that flow. Read this before making any change that touches more than one file. It is the map that prevents coupling mistakes.

### SECURITY_MODEL.md
Defines the trust boundaries, key handling rules, threat model, and global security constraints that apply to every component without exception. Covers certificate delivery, input-validation boundaries, registry limits, and production exclusions. HMAC/HKDF are deferred cryptographic-profile decisions, not a current verified control. Read this before touching main-pipeline/signingLayer.mjs, main-pipeline/verificationTool.mjs, or main-pipeline/registryClient.mjs. Security constraints in this document override convenience
in every case.

### IMPLEMENTATION_STATUS.md
The evidence-oriented record of what the current audit confirmed and what remains deferred. Before claiming a feature exists, check here. Before telling the working group something is implemented, verify it here first.

### DIAGRAMS.md
Visual representations of the pipeline flow, verification state machine, compression structure, and embedding carrier model. Reference when explaining the system to a new collaborator or when debugging a component interaction that is hard to reason about from code alone.

### CHANGELOG.md
Versioned record of every material change to the implementation. Each entry records what changed, which files were affected, what the motivation was, and whether any migration was required. The ES256 encoding fix (June 30, 2026) and the D.1–D.7 discrepancy audit fixes (July 3, 2026) are documented here in full.

---

## Environment Setup

### Prerequisites
- Node.js v22+ via nvm
- Dependencies installed via `npm install`
- `@contentauth/c2pa-node` must be pinned to v0.5.5 on Intel Mac

### Environment variables
Copy `.env.example` to `.env` and fill in:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SIGNING_ENABLED=true
```

### Key generation (first-time only)
[UPDATED — 2026-07-06] Use genpkey, not ecparam. ecparam produces
explicit-parameters encoding by default on LibreSSL (macOS), which
stricter ASN.1 parsers may reject. genpkey produces named-curve
PKCS#8 directly. See CHANGELOG.md 2026-07-06 entry.

```bash
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
  -out private.pem
openssl req -new -x509 -key private.pem -out cert.pem -days 365 \
  -subj "/CN=lps-reference-implementation-v0.1" \
  -addext "subjectKeyIdentifier=hash" \
  -addext "authorityKeyIdentifier=keyid:always" \
  -addext "basicConstraints=critical,CA:FALSE"
```

`private.pem` is gitignored. It must never be committed. `cert.pem` is
committed for v0.1 testing only and is hosted publicly at:
`https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem`

`private.pem` and `cert.pem` must be generated as a matching pair. If
they do not match, the embedded LPS selector payload may still survive
copy/paste, but verification will fail because the certificate public
key cannot validate the signature produced by the private key. The
signing layer now checks this before signing and fails with:

```text
Signing material mismatch: private.pem does not match cert.pem
```

When rotating local signing material, regenerate both files together
using the commands above, then publish the matching `cert.pem` wherever
`cert_url` points for that test.

---

## Running Tests

Each component has a dedicated test file. Run individually:

```bash
node test/testManifest.mjs
node test/testSigning.mjs
node test/testEmbedding.mjs
node test/testVerification.mjs
node test/testRegistry.mjs
node test/testRegistryVerification.mjs
node test/testConfidenceFallback.mjs
```

The current audit records assertion-backed integration and regression evidence,
including registry-routing and certificate-route checks. See
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) for the evidence scope;
do not characterize local test execution as production validation.

Historical test-maintenance records belong in
[`CHANGELOG.md`](CHANGELOG.md); the current audit evidence belongs in
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md). A configured HTTPS
certificate-route check is not production certificate governance. Registry
SLOs, monitoring, retry policy, incident response, rollback, and rate-limit
policy remain deferred.

---

## Local Editor Survival Testing

Use `test/lps-local-test-server.mjs` for manual copy/paste survival analysis.
This is the local main-pipeline test rig, not the removed demo survival-test-tool.

Run from the repository root:

```bash
node test/lps-local-test-server.mjs
```

Open:

```text
http://localhost:4173
```

Workflow:
- Generate/sign/embed text locally.
- Copy the embedded output into an editor or app.
- Copy it back out of that editor or app.
- Paste it into the verifier.
- Record the survival row returned by the tool.

The local server uses the real main-pipeline modules:
`generateManifest -> signManifest -> embedManifest -> verifyManifest`.
It opts into local `cert.pem` verification and skips registry lookup so
manual editor tests do not require internet certificate fetches or Supabase.
Production controls have not been validated and must not inherit those local
testing allowances.

This is an LPS selector-carrier test rig, not a C2PA A.8 conformance test.
Its trailing-whitespace behavior is an internal LPS hash rule, separate from
C2PA A.8 data-hash validation.

The test rig appends one JSONL entry to `verification-log.jsonl` in the
repository root on every verification run. This file is gitignored and
is not committed. It is the data source for the editor survival matrix.
To share specific results, export rows manually.

### Scoped operational observations

The July 2026 3–10-segment and carrier-size observations are scoped research
data, not a safe operating range, service-level target, or production
deployment guarantee. Carrier preservation, editor latency, platform
reclassification, and token overhead vary by transport and remain external
dependencies.

Token overhead is implementation- and platform-dependent. Integrations should
measure it in their own context; the reference audit does not validate a
production performance envelope.

Code-block carriage is outside the audited scope. Renderers may expose invisible
characters, and any file-level preservation observation is scoped rather than a
general transport guarantee. No carrier mechanism for inline or fenced code
blocks is defined.

---

#### Token overhead in language model integrations

Text carrying an LPS carrier can increase token use in downstream processing.
The reference audit does not establish general tokenizer behavior, platform
handling, or a deployment-size threshold. Any integration must measure its own
carrier, transport, and token-cost effects before relying on it operationally.

---

## Separate Proposal 007 research

Proposal 007 is a separate cooperative-marker testing-tool effort. It does not
amend the LPS selector-carrier pipeline, `ev: 1` envelope, registry behavior,
or audited result contract. Its 2026-07-31 local evidence is recorded as
tested behavior, not as a universal cross-platform or production guarantee.

| Tested path | Recorded Proposal 007 testing-tool result |
|---|---|
| Firefox/Linux drag-copy and double-click copy | 100% marker survival in the tested flows; the double-click flow showed no trailing space. |
| Tested BiDi-language content | 100% marker survival despite highlighting glitches. |
| Malformed sequence | Correct rejection: `E-0-0-2: INVALID_TYPE`. |
| Duplicate header | Correct rejection: `E006: DUPLICATE_HEADER`, normalized index `5`. |
| Orphaned open marker | Correct rejection: `E-007: ORPHANED_OPEN`, normalized index `5`. |
| Orphaned close marker | Correct rejection: `E-008: ORPHANED_CLOSE`, normalized index `34`. |
| Trailing normalization | Correct behavior and 100% marker survival in the tested flow. |
| Internal codepoints | Correct detection: `E-009: INTERNAL_SIGNAL`. |

The current testing-tool direction sets document-level headers, requires
support for different header sizes, keeps Lens 200 undefined and limited to
testing-tool scope, and excludes human spans, per-span ordinals, and per-span
total-count fields. Internal codepoints within valid marker context take the
internal-signal path.

### Proposed marker-tool boundary — ADR 2 (2026-07-24)

[`ADR_2`](ADR_2) is a **proposed**, separate testing-tool design record. It
uses an AI-only marker model and a document-scoped base-5 total-count header;
the header can support count-level anomaly reporting but cannot localize an
ordinal gap. The former human-marker selective-stripping signal is therefore
not available. The tool's approved U+2060–U+2064 library, normalization and
scan rules, and detailed error catalog do not alter the audited LPS envelope
or result contract. A future provider header-placement note in that ADR is not
an implemented LPS provider-integration requirement.

### Recorded cross-transport evidence — ADR 3 (2026-07-29)

[`ADR_3`](ADR_3) separately records route-specific Proposal 007 observations
for Facebook Messenger, Telegram, WhatsApp, Universal Clipboard, Facebook and
Instagram web, ChatGPT, Claude, Gemini, X, Photoshop, Android/iOS browser use,
Reddit, Notion, and Slack. “100% survival” means only that this testing tool
found valid signals for the named exercised route. Facebook Web's composer
retained signals while the observed post path did not; the record does not
attribute a cause. Selection is part of the received-input boundary: Messenger
double-click selection recorded a trailing U+0020, while Telegram and WhatsApp
required precise selection for reliable results. A missing or invalid signal
does not establish stripping, mutation, authorship, or provenance.

Rendering remains a usability and disclosure issue rather than a corruption
signal: Linux LibreOffice displayed no glyphs; Linux VS Code displayed yellow
outlined squares in code files only; Windows VS Code displayed rectangles;
Windows browser testing displayed no glyphs; and Windows OneNote displayed
`ƒ{}`. The evidence does not establish universal copy/paste preservation,
universal invisibility, codepoint-order preservation under BiDi selection, or
the cause of trailing-space observations in other environments.

See [`proposals/PROPOSAL_007.md`](proposals/PROPOSAL_007.md) for proposal
context, [`ADR_2`](ADR_2) for the proposed marker/header record,
[`ADR_3`](ADR_3) for the cross-transport record, and
[`local-files/ADR_4`](local-files/ADR_4) for the later local-test evidence
record and unresolved follow-ups.

---

## Git Remotes

This repository has one remote: origin.

```bash
git push origin main
```

---

## What Is Not In This Repository

- `PROPOSALS.md` — internal ideation, removed July 3 2026, lives in author
  notes only, never distributed
- `RESEARCH.md` — removed July 3 2026, content absorbed into CHANGELOG.md
  and IMPLEMENTATION_STATUS.md
- The public working-group discussion draft — lives in the public repo
- The public README (external orientation) — lives in the public repo

---

## Open Architectural Decisions

These are not implementation gaps — they are deliberate holds pending more
information. Do not resolve them unilaterally:

- **generating_id schema** — safety-only check in place; structural format
  (opaque token vs. structured identifier) deferred to working group feedback.
  See SPEC.md §9.
- **PRE-3 standards-conformance sweep** — pending verification work. No
  C2PA, COSE, JOSE, RFC 3161, X.509, SHA-256, certificate, canonicalization,
  or validation claim may be expanded before its evidence matrix is complete.
- **PROPOSAL 005** — deferred pending working-group feedback. Do not build or
  pre-submit revise its carrier, anchor, reconstruction, or key-hierarchy
  work.
- **PROPOSAL 006** — proposal only and under review. Revisit after
  submission; no active revision or implementation work.
- **LLM identifier prefix** — not designed or authorized. Its purpose,
  namespace, governance, lifecycle, privacy, transport, and authentication
  boundary require working-group agreement.
- **Canonical-CBOR profile and decoder bounds** — the current audit confirms
  duplicate-key rejection but not a complete canonical-CBOR profile or
  resource bounds. These remain deferred. See SECURITY_MODEL.md.
- **Broader cryptographic profile** — P-256 and HMAC/HKDF decisions, including
  any key hierarchy, remain deferred. Do not treat a historical anchor-layer
  note as a current cryptographic-profile decision.
- **Rate limiting on registerContent()** — Supabase-backed count query
  against created_at is the correct mechanism; created_at confirmed
  present on registry_records. Not yet built. The threshold value
  ("100 per generating_id per hour") carried in earlier internal notes
  was never derived from real usage data — no traffic pattern exists
  yet to base it on. Do not treat that number as settled. Decision on
  both threshold and window length deferred until real usage data
  exists. See SPEC.md §9.

---

*v0.1 — July 2026*
