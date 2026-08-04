# LPS Implementation Status

## Current audited baseline

The LPS reference implementation is accepted for its audited pipeline scope:
manifest creation, signing, embedding, compression, verification, and registry
recovery. This is not working-group ratification, production approval, or a
claim of interoperability with C2PA, SynthID, or another watermarking system.

This document records implementation and runtime evidence. The precise
protocol contract is in [`SPEC.md`](SPEC.md); security ownership and production
exclusions are in [`SECURITY_MODEL.md`](SECURITY_MODEL.md).

## Confirmed implementation and validation state

| Area | Current state | Evidence and boundary |
|---|---|---|
| Authenticated envelope | Confirmed | The current outer envelope uses direct `ev: 1`; it does not require `FIELD_MAP.ev`. `content_signed_at` is in the manifest and outer `signed_at` is authenticated. |
| Text binding | Confirmed | Trailing CR/LF/U+0020 stripping, UTF-8 encoding, SHA-256 hashing, and byte length are used as one text-binding path. |
| Confidence provenance | Confirmed | `tool` and `fallback` are distinguished. The locked fallback regression object is `{ ai_generated: 82, ai_modified_human: 15, human: 1 }`. |
| Envelope validation | Confirmed | Duplicate top-level envelope keys return `invalid_envelope / noncanonical_encoding / present` before version routing, cryptography, certificate retrieval, registry access, or fallback. Parseable invalid envelopes do not use registry fallback. |
| Carrier and registry routing | Confirmed | Valid carriers take normal verification. Absent, corrupted, and unparseable carriers use exact-hash recovery. Exact match, no match, unavailable, and invalid-response outcomes remain distinct. |
| Registry runtime behavior | Runtime-confirmed | Read-only live exact-match returned `registry_required / registry_match / absent`; read-only live no-match returned `degraded / registry_no_match / absent`. These are not availability or SLO evidence. |
| Certificate and tamper path | Runtime-confirmed | Verification through the configured allowed HTTPS certificate route succeeded; visible-text tampering returned `text_hash_mismatch`. This confirms the route, fingerprint, and signature path—not issuer governance. |
| Regression maintenance | Confirmed | `test/pipeline-contract.integration.test.mjs` completed 12 assertion-backed tests. The confidence, signing, and verification regressions were corrected from stale assertions and are assertion-backed. |
| Proposal 007 ADR records | Recorded separately; not LPS audit evidence | It is a proposed cooperative-marker testing-tool design. |

## Result-state boundary

The implementation distinguishes `verified`, `unsupported_version`,
`invalid_envelope`, `failed`, `registry_required`, and `degraded`. In
particular, a registry lookup is not normal valid-carrier verification:

```text
valid carrier                 → verified or failed
parseable invalid envelope    → invalid_envelope; no fallback
absent/corrupted/unparseable  → exact-hash registry recovery
exact match                   → registry_required / registry_match
no match                      → degraded / registry_no_match
transport or HTTP failure     → degraded / registry_unavailable
malformed/incomplete response → degraded / registry_response_invalid
```

The normative status, reason, and carrier-condition contract belongs to
[`SPEC.md`](SPEC.md). This summary exists to state what the audit confirmed.

### Separate Proposal 007 record boundary

Proposal 007's AI-only, document-header testing-tool design and its recorded
cross-transport observations must not be counted as LPS implementation tests.
In particular, route-specific marker survival only describes the received
marker sequence for that tool; it does not establish universal transport
preservation, provider behavior, authorship, or production suitability. The
records are maintained in [`ADR_2`](ADR_2) and [`ADR_3`](ADR_3).

## Production-only follow-ups

The following remain deferred and are not audit failures remediated by the
reference implementation:

- certificate issuer trust, revocation, rotation, and lifecycle governance;
- production key management, credential isolation, and credential policy;
- a complete canonical-CBOR profile and decoder resource bounds;
- broader cryptographic-profile decisions, including P-256 and HMAC/HKDF;
- provider, issuer, and `generating_id` identity semantics;
- registry SLOs, monitoring, retries, incident response, and rollback; and
- provider-attestation and authorized-issuer governance.

Test-only signing material and dotenv usage were suitable only for the audited
test context. They do not validate production key custody, issuer trust,
certificate governance, or deployment readiness.

## Working rule

Treat a capability as implemented only when this document records the relevant
audit evidence. Treat every production control listed above as deferred until
separate policy, implementation, and validation evidence exists.
