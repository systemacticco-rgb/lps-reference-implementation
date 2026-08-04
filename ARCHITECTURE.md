# LPS Architecture

## Purpose and scope

This document explains the audited reference implementation as a system: its
components, control flow, trust boundaries, and failure boundaries. It is
non-normative. [`SPEC.md`](SPEC.md) owns the exact interface and result
contract; [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) owns the
evidence and deferred-work record.

LPS binds visible text to an authenticated provenance manifest, embeds the
signed envelope in a carrier, verifies the envelope and text binding, and can
recover limited provenance state from an exact canonical-text-hash registry
lookup when a carrier is unavailable or unusable. The audited pipeline is:

```text
visible text → manifest → signed envelope → compressed CBOR → embedded carrier
visible text + carrier → extraction → validation → cryptographic verification → result
carrier unavailable → exact canonical-text hash → registry recovery result
```

LPS is an independent reference implementation. Use of a selector carrier or
the `c2pa-text` library does not establish C2PA conformance, SynthID
interoperability, or conformance with another AI-watermarking system.

## Components and responsibilities

| Component | Responsibility | Architectural boundary |
|---|---|---|
| `main-pipeline/manifestGenerator.mjs` | Builds the inner manifest from visible text and segments. | Applies the LPS trailing CR/LF/U+0020 strip and derives both `text_hash` and `text_length` from the resulting UTF-8 bytes. It holds `content_signed_at` and confidence provenance. |
| `main-pipeline/confidenceFallback.mjs` | Provides confidence only when it was not supplied. | The current contract distinguishes `tool` from `fallback`; a fallback value is not tool-supplied evidence. |
| `main-pipeline/signingLayer.mjs` | Creates the authenticated outer envelope. | Emits direct outer `ev: 1` and outer `signed_at`; both it and the inner manifest fields are authenticated. |
| `main-pipeline/compression.mjs` | Encodes and decodes the envelope for carriage. | Preserves direct outer `ev`; the version field is not a `FIELD_MAP` entry. |
| `main-pipeline/embeddingLayer.mjs` | Carries and extracts the encoded envelope without changing visible text. | The carrier is transport, not proof; visible text remains independently bound by hash and byte length. |
| `main-pipeline/verificationTool.mjs` | Classifies carrier state, validates the envelope, verifies it, checks text binding, and routes the result. | It rejects duplicate top-level envelope keys before version routing, cryptography, certificate retrieval, registry access, or fallback. |
| `main-pipeline/registryClient.mjs` | Looks up and validates exact canonical-text-hash recovery records. | Registry data corroborates an exact hash only; it is not issuer authentication or a normal valid-carrier dependency. |

## Generation path

1. The manifest generator strips trailing U+000D, U+000A, and U+0020 from
   visible text.
2. It converts that canonical text to UTF-8 bytes and derives both its
   SHA-256 `text_hash` and byte `text_length` from those same bytes.
3. It records the source record/commitment time as `content_signed_at` and
   records whether each confidence value is `tool`-supplied or `fallback`-
   derived.
4. The signing layer creates the outer envelope with authenticated `ev: 1`
   and `signed_at` metadata.
5. Compression and embedding create the carrier. Neither operation changes
   the visible text that the manifest binds.

## Verification and recovery path

The verifier does not treat every extraction problem alike. Its boundary is:

```text
duplicate top-level key     → invalid_envelope (no routing or external I/O)
parseable invalid envelope  → invalid_envelope (no registry fallback)
valid, parseable carrier    → normal certificate, signature, and text-binding path
absent/corrupted/unparseable carrier
                           → exact canonical-text-hash registry recovery path
```

For a valid carrier, normal processing produces `verified` when the signature,
certificate fingerprint, and text binding pass, or `failed` when the signed
claim cannot be validated against the received text. The canonical contract
for version errors, invalid-envelope reasons, and result fields is in
[`SPEC.md`](SPEC.md).

For carrier recovery, a matching registry record yields `registry_required /
registry_match`; a miss is `degraded / registry_no_match`. Transport or HTTP
failure is `degraded / registry_unavailable`; malformed or incomplete registry
data is `degraded / registry_response_invalid`. The carrier condition remains
visible for recovery results. None of those states is `verified`.

## Trust and failure boundaries

### Text and envelope

Visible text and carriers are untrusted input until processing completes. The
text hash and byte length bind the same canonical UTF-8 sequence, so a matching
hash alone is not the complete text-binding check. The authenticated envelope
contains the inner `content_signed_at` and outer `signed_at` with distinct
meanings: source record/commitment time and LPS complete-envelope signing time,
respectively.

### Certificate boundary

The implementation has runtime-confirmed verification through its configured
allowed HTTPS certificate retrieval route. Certificate fingerprint and
signature verification are part of that path. This does not establish issuer
trust, certificate revocation, rotation, lifecycle governance, or a
production credential policy.

### Registry boundary

The registry is used only for explicit recovery after an absent, corrupted, or
unparseable carrier. An exact match corroborates a generation-time record for
the canonical text hash; it cannot restore span-level evidence, explain carrier
loss, establish provider origin, or make a carrier-free artifact in-band
verified.

### Identity and provenance boundary

`generating_id` has only minimal safety validation in the audited scope. A
valid signature, hosted certificate, or certificate fingerprint does not make
an issuer authorized. Likewise, an LPS assertion is not independent
provider-origin evidence without a separate verified provider attestation.

## Deferred production boundaries

The audit does not establish production readiness. The following are deferred:

- certificate issuer trust, revocation, rotation, and lifecycle governance;
- production key management, credential isolation, and non-test signing
  controls;
- a complete canonical-CBOR profile and decoder resource bounds;
- broader cryptographic-profile decisions, including P-256 and HMAC/HKDF;
- formal provider, issuer, and `generating_id` identity semantics; and
- registry SLOs, monitoring, retry policy, incident response, and rollback.

Future provider attestation and authorized-issuer governance are trust-model
questions, not features implied by the current reference implementation.

## Separate Proposal 007 testing-tool boundary [NON-NORMATIVE]

Proposal 007 is a separate cooperative U+2060–U+2064 marker testing tool. It
is not a component of the v0.1 signed-selector-carrier pipeline, registry
recovery route, or LPS result contract. The proposed ADR 2 tool design uses
AI-only pair markers and one document-scoped, base-5 total-count header;
human spans and per-span ordinal or total-count fields are excluded. That
choice permits count-level anomaly reporting but not ordinal gap localization
or the former human-marker selective-stripping signal.

The recorded ADR 3 cross-transport observations belong at the received-input
boundary of that separate tool. A valid signal reports only the codepoint
sequence received after a named test route; a missing signal does not identify
stripping, mutation, authorship, provenance, or the responsible service.
Neither ADR adds an LPS cryptographic, carrier, registry, or production
architecture requirement.

## Documentation map

- [`public-repo/working-group-submission.md`](public-repo/working-group-submission.md)
  is the reviewer-facing explanatory map and records the bounded current scope.
- [`public-repo/README.md`](public-repo/README.md) is the concise public entry
  point.
- [`SPEC.md`](SPEC.md) defines the exact wire and result contract.
- [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) records audited
  validation evidence and production-only follow-ups.
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md) owns security controls and
  non-production exclusions.
- [`CHANGELOG.md`](CHANGELOG.md) records dated factual changes.
- [`ADR_2`](ADR_2) records proposed Proposal 007 marker/header design;
  [`ADR_3`](ADR_3) records separate, route-scoped Proposal 007 observations.
