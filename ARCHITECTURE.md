# LPS Architecture
## High-level system map for the reference implementation

This document explains how the LPS system fits together at a level above the implementation spec. It is intentionally high-level. The private `SPEC.md` remains the source of truth for code-level behavior. The public LPS proposal and working-group submission remain the source of truth for the standards-facing claims.

## 1. What LPS is

LPS (Linguistic Provenance Schema) is a proposed contribution-provenance layer for text. It records, at span level, whether a section was human-authored, AI-generated, or human text later modified by AI, along with confidence and modification degree. It does not replace C2PA or SynthID. It sits alongside them.

The current reference implementation proves that this model can be generated, signed, embedded, extracted, and verified with a modular pipeline. The next architectural step is Proposal 005, which adds redundant embedding and recovery paths.

## 2. Repository boundary

The public repository contains the proposal and the working-group submission. It is for reviewers, standards contributors, and external readers.

The private repository contains the reference implementation. It is for building, testing, and auditing the code.

The documents must not be mixed. Public documents explain the standard. Private documents explain the implementation. Personal notes and working drafts stay outside both.

## 3. System components

Current v0.1 components:

- `manifestGenerator.mjs` creates the manifest from segment data.
- `confidenceFallback.mjs` supplies fallback confidence when the tool does not provide it.
- `compression.mjs` shortens the manifest for embedding.
- `signingLayer.mjs` signs the manifest with ES256 using Node.js built-in crypto.
- `embeddingLayer.mjs` embeds and extracts the signed manifest using `c2pa-text`.
- `verificationTool.mjs` extracts, verifies, classifies the verification state, and renders the result.
- `registryClient.mjs` stores and retrieves server-side registry records in the stub implementation.
- `lps-local-test-server.mjs` supports local testing.
- `diag.mjs` supports diagnostics.

Planned but not yet built:

- `chunkLayer.mjs`
- `anchorLayer.mjs`
- `paragraphAnalysis.mjs`
- the full Proposal 005 reconstruction path
- the full production registry architecture
- the trust-list implementation
- the future COSE/JWS envelope path

## 4. End-to-end data flow

The current system flow is:

Text input
→ segment mapping
→ manifest generation
→ confidence assignment
→ compression
→ signing
→ embedding
→ extraction during verification
→ signature check
→ text-hash check
→ registry lookup if needed
→ verification state output

The visible text is not the same thing as the manifest. The manifest is the provenance record. The signature binds the manifest. The embedding layer carries the signed manifest inside the text. The verification tool compares the extracted text against the signed text hash and reports the appropriate state.

## 5. Trust boundaries

The main trust boundaries are:

- The visible text is untrusted until verified.
- The manifest is trusted only if its signature validates.
- The embedded carrier is only a transport mechanism, not the source of truth.
- The registry is a recovery path, not the primary provenance record.
- The certificate is trusted only after its fingerprint matches the expected value.
- The generating AI tool is the authoritative source of confidence when it supplies confidence directly.

A second source of truth is avoided wherever possible. If two layers disagree, the verifier should report that disagreement instead of trying to silently repair it.

## 6. Cryptographic flow

The cryptographic path is deliberately narrow:

1. The manifest is serialized to bytes.
2. The bytes are signed with ES256.
3. The signature uses IEEE P1363 raw r‖s encoding.
4. The certificate is distributed separately through a public URL plus fingerprint.
5. The verifier fetches the certificate, confirms the fingerprint, and checks the signature.
6. The verifier hashes the extracted clean text and compares it to `text_hash`.

Important boundaries:

- The implementation uses Node.js built-in crypto.
- The implementation does not implement cryptographic primitives from scratch.
- The current reference implementation is primitive-level interoperable with ES256 tooling.
- The manifest itself is not currently packaged as a standard COSE_Sign1 or compact JWS envelope.
- Envelope-level interoperability is a future version target, not current state.

## 7. Verification flow

The verifier performs the following sequence:

- extract the embedded manifest
- verify the signature
- confirm certificate validity
- hash the clean extracted text
- compare that hash with the signed `text_hash`
- if needed, query the registry
- return a structured verification state

Built v0.1 states:

- `verified`
- `failed`
- `degraded`
- `registry_required`

Planned Proposal 005 states:

- `anchor_only`
- `partial_recovery`
- `injection_detected`
- `reconstruction_corrupted`

The Proposal 005 states are architectural definitions only at this stage. They do not exist in the current reference implementation.

## 8. Implementation status

Built and tested in v0.1:

- manifest generation
- signing
- embedding
- verification
- confidence fallback
- registry stub
- current test suite for the built pipeline

Defined but not yet built:

- redundant embedding
- anchor manifests
- paragraph-level reconstruction
- cross-copy recovery
- trust-list enforcement
- production registry governance
- full envelope interoperability

Partially implemented:

- registry storage and lookup via Supabase stub
- registry-required verification path

Intended but not yet implemented in the current reference implementation:

- certificate revocation checking
- full production registry access control
- HMAC-protected anchors
- chunk reconstruction logic
- session-anchor certificate pinning
- magic-prefix reconstruction safeguards

## 9. Security model

The security model is conservative.

The system assumes the following:

- manifests may be tampered with
- carriers may be stripped
- certificates may be invalid or revoked
- registry data may be absent
- verification may happen long after generation
- future proposals may introduce new recovery states

The system does not assume:

- honest input
- intact carriers
- a trusted transport layer
- a single verification path
- a single implementation environment

The verifier should fail visibly when it cannot prove integrity, rather than silently infer correctness.

## 10. Document map

Use the documents this way:

- `SPEC.md` — implementation rules and normative build behavior
- public LPS README / proposal — public explanation of the standard
- working-group submission — review-facing argument and status summary
- this file — architecture map
- `RESEARCH.md` — references, discoveries, and rationale
- `PROPOSALS.md` — future architecture after v0.1

## 11. Core takeaway

LPS is a layered provenance system: manifest generation defines what is being claimed, signing protects that claim, embedding carries it through text transport, verification checks integrity, and the registry recovers evidence when the embedded carrier is lost. The current codebase proves the baseline architecture. Proposal 005 extends it with redundancy and recovery without changing the fundamental separation between provenance, transport, and verification.
