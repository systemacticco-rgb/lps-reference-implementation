# CHANGELOG.md

This changelog records architectural, security, and documentation changes for the LPS reference implementation. It is not a Git commit log. It is a human-readable record of why the system changed.

## 2026-07-03 — Documentation structure added

- Added `ARCHITECTURE.md` as the high-level system map.
- Added `DIAGRAMS.md` to show component flow, trust boundaries, verification flow, and future Proposal 005 structure.
- Added `IMPLEMENTATION_STATUS.md` to separate built, defined, planned, and placeholder work.
- Added `SECURITY_MODEL.md` to capture the system threat model, trust assumptions, invariants, and non-goals.
- Established a clearer documentation hierarchy:
  - README.md = what the project is
  - ARCHITECTURE.md = how the system fits together
  - SPEC.md = precise implementation specification
  - DIAGRAMS.md = visual map
  - IMPLEMENTATION_STATUS.md = build status
  - SECURITY_MODEL.md = security posture

## 2026-06-30 — ES256 signature encoding correction

- Corrected manifest signing and verification to use `dsaEncoding: 'ieee-p1363'`.
- Closed the mismatch between the `es256` label and Node's default DER signature output.
- Confirmed internal round-trip verification passes.
- Confirmed an independent cross-check with the panva/jose library passes at the primitive level.
- Clarified that LPS still does not emit a JOSE or COSE envelope in v0.1.
- Marked envelope-level interoperability as future work.

## 2026-06-21 — Registry stub added

- Added a registry stub backed by Supabase.
- Implemented registration and lookup by token and content hash.
- Added registry verification behavior for the `registry_required` state.
- Introduced usage-event logging for registry queries.
- Kept the production registry architecture separate from the v0.1 stub.

## 2026-06-20 — Compression and capacity work

- Measured manifest size against the Unicode variation selector capacity ceiling.
- Added shortcode compression as a core v0.1 size reduction step.
- Documented the move toward CBOR encoding as a later optimization.
- Established the 220-byte trigger threshold for fallback embedding behavior.
- Separated the current A.8 embedding path from the future A.9 / redundant-embedding path.

## 2026-06-19 — Core pipeline completed

- Completed the four main v0.1 components:
  - manifest generation
  - signing
  - embedding
  - verification
- Added the confidence fallback mechanism.
- Added the initial test suite for the baseline pipeline.
- Established the built verification states:
  - verified
  - failed
  - degraded
  - registry_required

## 2026-06 — Proposal and research foundation

- Defined LPS as a span-level AI contribution provenance schema for C2PA-compatible text workflows.
- Identified the gap between binary AI involvement claims and granular contribution tracking.
- Separated built v0.1 behavior from future Proposal 005 work.
- Documented future verification states for redundant embedding and cross-copy reconstruction:
  - anchor_only
  - partial_recovery
  - injection_detected
  - reconstruction_corrupted

## Change-log rule

If a feature is not explicitly marked as built, treat it as specified or planned rather than implemented.
