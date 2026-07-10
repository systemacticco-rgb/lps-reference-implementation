# LPS Implementation Status

This file records the current state of the LPS reference implementation and related planned work. It is meant to stay aligned with the private SPEC, the architecture document, and the public proposal.

## Current baseline

The v0.1 reference implementation is built and testable. The core pipeline is complete, and the main security correction on ES256 encoding has been applied.

## Built and tested

| Area | Status | Notes |
|---|---|---|
| Manifest generation | Built | Produces the LPS manifest from segment input. |
| Signing layer | Built | Uses Node.js built-in crypto with ES256 / P-256 / SHA-256 and IEEE P1363 raw r‖s encoding. SIGNING_ENABLED environment-variable killswitch enforced as the first statement in signManifest(), before any key access — confirmed working 2026-07-05. Local signing now also refuses to sign when `private.pem` and `cert.pem` are not a matching key pair. |
| Embedding layer | Built | Uses the current c2pa-text A.8 contiguous invisible Unicode variation-selector carrier. No distributed or redundant carrier is implemented. |
| Verification tool | Built | Verifies signature, text hash, recovery states, and A.8 extraction only. A.9 structured extraction was removed from the v0.1 verifier. |
| Registry stub | Built | Supabase-backed stub exists for token/content-hash lookup and logging. |
| Confidence fallback | Built | Mathematical fallback implemented with confidence source tracking. |
| Local survival test rig | Built | `lps-local-test-server.mjs` runs the root pipeline locally and records manual editor round-trip results. |
| Core test suite | Built | Original v0.1 tests pass. |

## Built but still under review

| Area | Status | Notes |
|---|---|---|
| SPEC wording | In review | Needs consistency pass to ensure the document matches implementation status exactly. |
| Public proposal text | In review | Must continue to be checked against the implementation and the working-group checklist. |
| Certificate / registry narrative | In review | The implementation exists, but the long-term production architecture remains separate from the stub. |

## Specified but not yet built

| Area | Status | Notes |
|---|---|---|
| PROPOSAL 005 | Specified | Conceptual architecture only. A.8R is the current design direction replacing the removed A.9 fallback, but its carrier format, arbitrary-position embedding capability, reconstruction rules, and validation semantics remain under definition and are not implemented. |
| Anchor manifests | Not built | Defined for future work only. |
| Cross-copy reconstruction | Not built | Defined for future work only. |
| anchor_only verification state | Not built | Future output state. |
| partial_recovery verification state | Not built | Future output state. |
| injection_detected verification state | Not built | Future output state. |
| reconstruction_corrupted verification state | Not built | Future output state. |
| Chunk layer | Not built | Future component for PROPOSAL 005. |
| Paragraph analysis | Not built | Future component for PROPOSAL 005. |
| Audit harness | Not built | Future test coverage for PROPOSAL 005. |
| Production trust-list governance | Not built | Architecture specified, implementation pending. |
| Full registry production architecture | Not built | Stub exists; production design remains pending. |

## Security and interoperability status

- ES256 signature encoding mismatch was corrected on June 30 2026.
- Local signing-material mismatch is now detected before signing, so
  copy/paste survival failures are not confused with a stale or
  unrelated `cert.pem`.
- Primitive-level interoperability has been cross-checked against the panva/jose library.
- Envelope-level interoperability is not implemented yet.
- Local survival testing may explicitly allow local `cert.pem`
  resolution. Production certificate URL policy remains strict.
- Revocation checking belongs to the production architecture, not the current reference implementation.
- HMAC-based anchor derivation remains a future architectural decision until PROPOSAL 005 is implemented.

## Working rule

If a feature is not explicitly marked as built, it must be treated as undefined for the implementation until it is added, tested, and documented.
