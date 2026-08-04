# LPS Reference Implementation

**Repository:** lps-reference-implementation 

**Maintained by:** Brayan Daniel Rodriguez Lugo — systemacticco-rgb

**Status:** v0.1 — audited reference pipeline; not production approval

**Counterpart:** github.com/systemacticco-rgb/linguistic-provenance-schema

---

## What This Repository Is

This is the implementation repository for the Linguistic Provenance Schema (LPS). It contains the working reference implementation, the internal technical specification, architecture and security documentation, and the changelog.

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
├── proposals/
│   ├── PROPOSAL_005.md           
│   ├── PROPOSAL_006.md       
│   └── PROPOSAL_007.md   
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
Defines the trust boundaries, key handling rules, threat model, and global security constraints that apply to every component without exception. Covers certificate delivery, input-validation boundaries, registry limits, and production exclusions. Read this before touching main-pipeline/signingLayer.mjs, main-pipeline/verificationTool.mjs, or main-pipeline/registryClient.mjs. Security constraints in this document override convenience
in every case.

### IMPLEMENTATION_STATUS.md
The evidence-oriented record of what the current audit confirmed and what remains deferred. Before claiming a feature exists, check here. Before telling the working group something is implemented, verify it here first.

### DIAGRAMS.md
Visual representations of the pipeline flow, verification state machine, compression structure, and embedding carrier model. Reference when explaining the system to a new collaborator or when debugging a component interaction that is hard to reason about from code alone.

### CHANGELOG.md
Versioned record of every material change to the implementation. Each entry records what changed, which files were affected, what the motivation was, and whether any migration was required. 

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
Use genpkey, not ecparam. ecparam produces
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

### Proposed marker-tool boundary 

Is a **proposed**, separate testing-tool design record. It
uses an AI-only marker model and a document-scoped base-5 total-count header;
the header can support count-level anomaly reporting but cannot localize an
ordinal gap. The former human-marker selective-stripping signal is therefore
not available. The tool's approved U+2060–U+2064 library, normalization and
scan rules, and detailed error catalog do not alter the audited LPS envelope
or result contract.

### Recorded cross-transport evidence 

Separately records route-specific Proposal 007 observations
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
context.

---

## Git Remotes

This repository has one remote: origin.

```bash
git push origin main
```

---

## Open Architectural Decisions

These are not implementation gaps — they are deliberate holds pending more
information. Do not resolve them unilaterally:

- **generating_id schema** — safety-only check in place; structural format
  (opaque token vs. structured identifier) deferred to working group feedback.
  See SPEC.md §9.
- **PROPOSAL 005** — deferred pending working-group feedback.
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
  present on registry_records. Not yet built.

---

*v0.1 — July 2026*
