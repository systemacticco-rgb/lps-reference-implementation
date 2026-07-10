# lps-reference-implementation```markdown
# LPS Reference Implementation

**Repository:** lps-reference-implementation (private)
**Maintained by:** Brayan Daniel Rodriguez Lugo — systemacticco-rgb
**Status:** v0.1 — core pipeline built and locally tested
**Counterpart (public):** github.com/systemacticco-rgb/linguistic-provenance-schema

---

## What This Repository Is

This is the private implementation repository for the Linguistic Provenance
Schema (LPS). It contains the working reference implementation, the internal
technical specification, architecture and security documentation, and the
changelog. It is not the public-facing proposal. That lives in the public
repository above.

This repository is the build authority. If there is ever a conflict between
what a document says and what the code does, the discrepancy is a bug to be
resolved — not an invitation to follow whichever source is more convenient.
SPEC.md is the agent-directive specification. README.md in the public repo
is the schema authority. Code follows both.

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
├── manifestGenerator.mjs         Stage 1 — manifest generation
├── signingLayer.mjs              Stage 2 — ECDSA P-256 signing
├── embeddingLayer.mjs            Stage 3 — Unicode carrier embedding
├── verificationTool.mjs          Stage 4 — extraction and verification
├── compression.mjs               Shortcode compression + CBOR encode/decode
├── registryClient.mjs            Supabase registry stub (register + query)
├── confidenceFallback.mjs        Mathematical fallback confidence derivation
├── testManifest.mjs              Stage 1 test
├── testSigning.mjs               Stage 2 test
├── testEmbedding.mjs             Stage 3 test
├── testVerification.mjs          Stage 4 test
├── testRegistry.mjs              Registry registration and query test
├── testRegistryVerification.mjs  registry_required state test
├── testConfidenceFallback.mjs    Fallback confidence calculation test
├── lps-local-test-server.mjs     Local editor survival-analysis rig
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
| What does the manifest schema look like? | README.md in the public repo (§3.2) |
| How should a build agent implement a component? | SPEC.md (this repo) |
| What is the current build status of each component? | IMPLEMENTATION_STATUS.md |
| What cryptographic decisions are locked vs open? | SECURITY_MODEL.md |
| What changed and when? | CHANGELOG.md |
| How do the components connect as a system? | ARCHITECTURE.md |
| What does the system look like visually? | DIAGRAMS.md |
| What is proposed but not yet built? | PROPOSALS.md in the public repo |

Schema changes always happen in the public repo README.md first. SPEC.md
and code follow. Never change the schema in code first.

---

## Document Summaries

### SPEC.md
The internal build specification. Written in agent-directive voice — it tells
build agents exactly how to implement each component. It is not sanitized for
external review and must not be shared with the working group as-is. It covers
input format, confidence source contract, manifest compression, signing
constraints, embedding layer, verification outputs, registry validation,
security globals, test requirements, and open questions. Every component
section is labeled BUILT, DEFINED, PLANNED, or PLACEHOLDER. If a section
is not explicitly marked BUILT, treat it as undefined.

### ARCHITECTURE.md
Describes how the four pipeline stages connect — manifest generation, signing,
embedding, verification — and how the registry, certificate store, and
compression layer fit within that flow. Read this before making any change
that touches more than one file. It is the map that prevents coupling mistakes.

### SECURITY_MODEL.md
Defines the trust boundaries, key handling rules, threat model, and global
security constraints that apply to every component without exception. Covers
private key storage, HMAC comparison requirements, certificate delivery,
input validation policy, and what each verification state means forensically.
Read this before touching signingLayer.mjs, verificationTool.mjs, or
registryClient.mjs. Security constraints in this document override convenience
in every case.

### IMPLEMENTATION_STATUS.md
The single source of truth for what is actually built and tested versus what
is only specified or planned. Before claiming a feature exists, check here.
Before telling the working group something is implemented, verify it here
first. It is updated on every commit that changes build status.

### DIAGRAMS.md
Visual representations of the pipeline flow, verification state machine,
compression structure, and embedding carrier model. Reference when explaining
the system to a new collaborator or when debugging a component interaction
that is hard to reason about from code alone.

### CHANGELOG.md
Versioned record of every material change to the implementation. Each entry
records what changed, which files were affected, what the motivation was, and
whether any migration was required. The ES256 encoding fix (June 30, 2026)
and the D.1–D.7 discrepancy audit fixes (July 3, 2026) are documented here
in full.

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
they do not match, the embedded A.8 manifest may still survive
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
node testManifest.mjs
node testSigning.mjs
node testEmbedding.mjs
node testVerification.mjs
node testRegistry.mjs
node testRegistryVerification.mjs
node testConfidenceFallback.mjs
```

All seven tests passing as of July 6, 2026. If any test fails after a change,
do not commit. Resolve the failure first.

[2026-07-08] cert_url in signingLayer.mjs changed from file://
placeholder to production HTTPS URL. First full end-to-end pipeline
verification under production cert confirmed passing. testVerification.mjs
clean case (J.3) no longer requires allowLocalCert. All seven tests
passing under production conditions.

[2026-07-04 7:31pm] The two D.6 text_length threshold cases below were not
ordinary coverage gaps. Their absence was hiding a live defect: the
disclose-branch in verificationTool.mjs's STEP 4 contained a dead duplicate
of evaluateDisclosureThreshold()'s decision logic, referencing undeclared
variables. Any real small-edit input reaching that branch would have thrown
an unhandled ReferenceError instead of returning a failed status with
original_manifest disclosed. The duplicate has been removed — the call site
now uses evaluateDisclosureThreshold()'s decision directly, with no
recomputation. Both cases have been added to testVerification.mjs and
confirmed passing in the real environment: small-edit (2% delta) discloses
original_manifest as expected; extreme-mismatch (18% delta) withholds it as
expected. See CHANGELOG.md 2026-07-04 (7:31pm) entry for the full defect
record.

Remaining outstanding test gap, tracked in SPEC.md §8:
- Registry input validation cases: invalid hash format, invalid generating_id,
  rate limit enforcement (not yet built).

---

## Local Editor Survival Testing

Use `lps-local-test-server.mjs` for manual copy/paste survival analysis.
This is the local root-pipeline rig, not the removed demo survival-test-tool.

Run from the repository root:

```bash
node lps-local-test-server.mjs
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

The local server uses the real root modules:
`generateManifest -> signManifest -> embedManifest -> verifyManifest`.
It opts into local `cert.pem` verification and skips registry lookup so
manual editor tests do not require internet certificate fetches or Supabase.
Production verification remains stricter and should not inherit those local
testing allowances.

The test rig appends one JSONL entry to `verification-log.jsonl` in the
repository root on every verification run. This file is gitignored and
is not committed. It is the data source for the editor survival matrix.
To share specific results, export rows manually.

### Production constraints and safe operating ranges

Safe manifest size: production manifests with realistic segment counts
(3–10 segments) land between 400 bytes and 1,500 bytes compressed.
Invisible character counts at this size remain below approximately
3,000 variation selectors. Editor copy-paste behavior at this size is
clean across all editors tested in the July 2026 survival study.

Editor latency threshold: invisible character counts above approximately
6,000 variation selectors — corresponding to manifests above
approximately 2,500–3,000 bytes — produce measurable copy-paste latency
in rich-text editors that process character-level clipboard payloads.
Apple Notes on macOS exhibits this behavior at 5kb manifest size and
above. Latency is not carrier corruption — verification succeeds at all
tested sizes.

AI compose input reclassification: platforms including Claude and the
OpenAI ecosystem may reclassify large invisible-character payloads as
file uploads rather than plain text when pasted into compose inputs. The
manifest survives reclassification but the workflow breaks. The
reclassification threshold varies by platform and is not under LPS
control. Measurement across all target platforms is an open item
(OPEN-4).

Token overhead: see the token overhead section above.

Code block constraint: LPS manifests must not be embedded inside code
syntax blocks. Code renderers display invisible Unicode characters as
visible replacement icons or colored markers. GitHub preserves the
manifest invisibly at the file level. The constraint applies to inline
and fenced code blocks only.

---

## Git Remotes

This repository has three remotes. All three must receive every push:

```bash
git push origin main
```

Never push to one remote only. Never run `git remote -v` after a token update.

---

## What Is Not In This Repository

- `PROPOSALS.md` — internal ideation, removed July 3 2026, lives in author
  notes only, never distributed
- `RESEARCH.md` — removed July 3 2026, content absorbed into CHANGELOG.md
  and IMPLEMENTATION_STATUS.md
- `pending/` — removed July 3 2026
- `study/` — removed July 3 2026
- The public working-group submission document — lives in the public repo
- The public README (schema authority) — lives in the public repo

---

## Open Architectural Decisions

These are not implementation gaps — they are deliberate holds pending more
information. Do not resolve them unilaterally:

- **generating_id schema** — safety-only check in place; structural format
  (opaque token vs. structured identifier) deferred to working group feedback.
  See SPEC.md §9.
- **PROPOSAL 005 key hierarchy** — HKDF-SHA256 confirmed as primitive; ikm,
  salt, and info not yet locked pending root-of-trust decision.
- **Canonicalization version pinning** — cbor's exact resolved version
  is currently pinned via package-lock.json only; package.json itself
  still ranges. Freezing the encoder permanently (Path A) or tagging
  manifests with an encoder version (Path B, rejected — creates a
  circular trust problem for PROPOSAL 005 reconstruction) were both
  evaluated and deferred. Decision required before PROPOSAL 005 ships
  or before working-group feedback requires an answer. See
  SECURITY_MODEL.md.
- **HMAC vs. asymmetric for anchor layer** — HMAC correct if anchor is an
  internal self-check; asymmetric required if independent third-party
  verification of reconstructed manifests is a product goal. Decision pending.
- **Rate limiting on registerContent()** — Supabase-backed count query
  against created_at is the correct mechanism; created_at confirmed
  present on registry_records. Not yet built. The threshold value
  ("100 per generating_id per hour") carried in earlier internal notes
  was never derived from real usage data — no traffic pattern exists
  yet to base it on. Do not treat that number as settled. Decision on
  both threshold and window length deferred until real usage data
  exists. See SPEC.md §9.
- **SPEC.md §3 anchor HMAC derivation line** — currently states
  createSign('SHA256'), no HKDF. Flagged as stale. Not corrected until key
  hierarchy is locked.

---

*v0.1 — July 2026*
```
