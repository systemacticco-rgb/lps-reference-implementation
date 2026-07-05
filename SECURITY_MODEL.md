# SECURITY_MODEL.md

## Purpose

This document defines the security model for the LPS reference implementation. It states what the system protects, where trust boundaries exist, what attackers are assumed to do, and which security properties are required for the v0.1 baseline and for future work such as PROPOSAL 005.

## Security goals

LPS is designed to preserve the integrity of provenance claims for text content. The core goals are:

- bind a signed manifest to a specific visible text representation
- detect post-signing modification of visible text
- preserve provenance signals through supported text embedding methods
- provide a deterministic recovery path when carrier stripping occurs and registry data is available
- make implementation status explicit so built behavior is never confused with future proposals
- avoid claiming authorship truth; LPS proves claim integrity, not claim truth

## Primary assets

The main assets protected by the system are:

- the visible text being described
- the canonical manifest derived from that text
- the signature over the canonical manifest
- the certificate used to verify the signature
- the content hash used for recovery and replay detection
- registry records containing hashes, tokens, and timestamps
- any derived HMAC material used for future anchor-layer work
- the trust relationship between the verifier and the certificate source

## Trust boundaries

LPS has several distinct trust boundaries:

- between the authoring tool and the manifest generator
- between the manifest and the signing layer
- between the embedded carrier and the external document surface
- between the verifier and the registry
- between local implementation state and future proposal-only architecture
- between public proposal text and private implementation details

No component should silently assume another component’s internal format unless that dependency is explicitly specified.

## Threat model

LPS is built against adversaries who may:

- modify visible text after signing
- strip invisible carriers
- replay valid provenance onto different text
- forge manifests or certificates
- inject malformed or adversarial payloads into text
- exploit ambiguity in documentation or implementation status
- exploit differences between encodings, canonicalization rules, or verification behavior across tools
- flood or poison the registry with invalid records
- attempt to trigger inconsistent recovery behavior across modules

The system should also assume honest failure modes such as network loss, certificate fetch failure, malformed input, Unicode normalization differences, and partial document corruption.

## Security assumptions

The v0.1 baseline assumes:

- the private signing key remains secret
- the public certificate is trustworthy only after successful validation
- canonical text extraction is deterministic
- Node.js built-in crypto behaves according to its documented primitives
- the implementation uses audited libraries only
- the registry is not the source of truth; it is a recovery path
- current v0.1 behavior is the authoritative implementation unless a proposal is explicitly marked as future work
- canonicalization determinism (which `cbor` encoding behavior produced
  a given manifest's signed bytes) is currently guaranteed only by
  `package-lock.json` pinning every environment to the same exact
  resolved version — not by version-string pinning in `package.json`
  itself. This is sufficient only as long as the current reference
  implementation is the sole verifier of its own signatures. It stops
  being sufficient once dependencies are upgraded and independent
  parties need to verify manifests signed under a prior version.
  PROPOSAL 005's cross-copy reconstruction path makes this a harder
  problem, not just a relevant one: reconstruction requires re-deriving
  canonical bytes from recovered fragments, and tagging the manifest
  with a canonicalization-version field creates a circular trust
  problem — the verifier cannot know which encoder to use without
  first trusting the field that names it, and cannot trust that field
  without already having verified it. No resolution is adopted yet.
  This must be decided before PROPOSAL 005 ships, or before any
  working-group feedback requires an answer sooner.

## Invariants

The following must remain true:

- the signature must cover the canonical manifest bytes, not the visible text directly
- the verification tool must compare the extracted clean text hash against the manifest text hash
- disclosure of original_manifest in the failed state must be gated by the length-mismatch threshold; a manifest with a missing or unreadable text_length must fail closed (no disclosure) rather than silently falling through to a disclosure decision
- built features must never be described as future work, and future work must never be described as built
- algorithm labels must not claim envelope compatibility that the implementation does not provide
- registry lookup must never be treated as a substitute for signature verification
- no cryptographic primitive is implemented from scratch
- no hidden second source of truth is allowed for the same security decision
- if implementation status is not explicitly marked built, it must be treated as undefined by the codebase and by reviewers

## Non-goals

LPS does not aim to:

- prove that a human personally wrote a span
- detect AI authorship from text alone
- survive screenshots, OCR, or heavy rewrite through the embedded carrier alone
- replace C2PA, SynthID, or other provenance systems
- provide legal conclusions
- provide full envelope-level JOSE or COSE interoperability in v0.1
- solve every registry governance question in the baseline implementation

## Current implementation status

The v0.1 reference implementation includes:

- manifest generation
- signing
- embedding
- verification
- confidence fallback
- registry stub behavior for lookup and logging

The following are specified but not built:

- PROPOSAL 005 anchor layer
- redundant embedding
- cross-copy reconstruction
- future verification states such as anchor_only, partial_recovery, injection_detected, and reconstruction_corrupted
- production trust-list governance
- full production registry architecture
- envelope-level COSE_Sign1 or compact JWS packaging

## Failure handling

If a security check fails, the implementation should prefer explicit failure over silent degradation. The intended outcomes are:

- verified when signature and text hash both match
- failed when text or signature validation fails
- degraded when carrier recovery is not possible
- registry_required when no carrier exists but registry recovery succeeds

Partial future states must never be confused with verified. Future states only describe future architecture unless the corresponding code exists and is tested.

## Review posture

A working-group or security reviewer should be able to ask:

- what is protected
- what is trusted
- what can fail
- what an attacker can do
- what the system does not claim
- what is built today versus only specified

If any answer is unclear, the document or the implementation is too loose.
