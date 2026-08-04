# LPS Security Model

## Scope

This document states the security boundaries of the audited LPS reference
implementation. It distinguishes controls confirmed in that scope from
production controls that remain deferred. It does not grant production
deployment approval, establish issuer authorization, or make C2PA, SynthID, or
general AI-watermarking interoperability claims.

The exact protocol contract is in [`SPEC.md`](SPEC.md); audited evidence is in
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

## Confirmed security properties

### Authenticated record and text binding

- The direct outer `ev: 1` field is authenticated; it is not represented by
  `FIELD_MAP.ev`.
- `content_signed_at` is in the inner manifest and records the generating
  source's content-record signing or commitment time. Outer `signed_at` records
  when LPS signed the complete envelope. Both are authenticated.
- Text binding first strips trailing U+000D, U+000A, and U+0020, then derives
  `text_hash` (SHA-256) and byte `text_length` from the same UTF-8 byte
  sequence. Both checks participate in the text-binding contract.
- `confidence_source` distinguishes a tool-supplied confidence value from an
  LPS fallback value. It is provenance about the value, not evidence of the
  truth of the underlying origin claim.

### Envelope-validation boundary

Duplicate top-level CBOR envelope keys are rejected before version routing,
cryptographic verification, certificate retrieval, registry access, or
fallback. Their result is:

```text
invalid_envelope / noncanonical_encoding / present
```

A parseable but invalid envelope is also `invalid_envelope`; it must not be
converted into registry recovery. This prevents decoder key collapse or schema
failure from silently choosing a different security path.

### Certificate-verification boundary

The audited verifier accepts certificate retrieval only through its configured
allowed HTTPS route and requires both certificate-fingerprint and signature
verification. Runtime evidence confirms that route and visible-text tamper
detection. This is a constrained retrieval and verification control, not a
claim that the certificate issuer is trusted.

### Registry-recovery boundary

Registry lookup is not a normal verification dependency. It is available only
when a carrier is absent, corrupted, or unparseable, and it uses an exact
canonical-text hash. Its failure behavior is fail-closed:

| Condition | Security result |
|---|---|
| Exact registry match | `registry_required / registry_match` |
| No registry match | `degraded / registry_no_match` |
| Transport or HTTP failure | `degraded / registry_unavailable` |
| Malformed or incomplete response | `degraded / registry_response_invalid` |

No registry outcome makes a carrier-free artifact `verified`, restores
segment-level evidence, proves carrier removal, or authenticates an issuer.

### Proposal 007 testing-tool marker boundary [SEPARATE, OBSERVED SCOPE]

Proposal 007 marker testing is separate from the audited LPS envelope and its
verification result contract. Its local test evidence records these
testing-tool validation outcomes, which must remain deterministic after the
tool's normalization step:

| Condition | Required testing-tool outcome | Observed boundary |
|---|---|---|
| Malformed sequence | `E-0-0-2: INVALID_TYPE` | Correct rejection |
| Duplicate header | `E006: DUPLICATE_HEADER`, normalized index `5` | Correct rejection after marker survival |
| Orphaned open marker | `E-007: ORPHANED_OPEN`, normalized index `5` | Correct rejection |
| Orphaned close marker | `E-008: ORPHANED_CLOSE`, normalized index `34` | Correct rejection |
| Internal codepoint in valid marker context | `E-009: INTERNAL_SIGNAL` | Correct detection after tested browser transit |

The same observed record reports valid results for Firefox/Linux drag-copy,
double-click copy, tested BiDi-language content, and trailing normalization.
Those paths showed marker survival in the tested flows, but they do not prove
cross-platform, cross-browser, cross-editor, or provider compatibility.

It records a proposed, testing-tool-only AI-marker grammar:
one document-scoped total-count header, no human markers, and no per-span
ordinals or totals. Its count can expose an excess-pair anomaly but cannot
localize a missing ordinal or preserve the former human-marker
selective-stripping signal. An internal approved-library codepoint inside a
valid pair is a forensic signal; it does not authenticate the content or make
the enclosing pair provenance evidence, and does not remove that pair from the
tool's valid-pair count. The proposed grammar's detailed error catalog is
distinct from the LPS `status`, `reason_code`, and
`carrier_condition` contract.

It adds recorded cross-transport observations for the separate
tool. Its route results, including messenger selection effects and the
Facebook Web composer/post difference, describe only the received codepoint
sequence. Neither a valid signal nor a missing signal identifies a service as
the cause, proves stripping or mutation, establishes provenance or authorship,
or supplies a production security control.

Visual glyphs are a usability and disclosure concern, not proof of corruption:
the observed rendering varied by operating system, application, and file type.
Marker corruption must be established by codepoint loss, mutation, reordering,
or a testing-tool validation failure. The unresolved security-relevant work is
to determine whether clipboard layers cause trailing spaces, whether BiDi
selection can alter codepoint order or selection boundaries, and whether the
testing-tool's future production grammar, marker-injection controls, and
provider-compliance model need separate architecture decisions.

## Trust boundaries

| Boundary | What is confirmed | What is not established |
|---|---|---|
| Visible text and carrier | Both are untrusted until validation completes. | Carrier loss does not establish stripping, intent, authorship, or human origin. |
| Generating source | It can supply confidence marked `tool`; absent confidence receives `fallback`. | No formal provider identity, provider attestation, or `generating_id` semantics are established. |
| Signing material | Test-only material supported the audited reference tests. | Production key custody, isolation, rotation, access controls, and credential policy are not validated. |
| Certificate route | Configured HTTPS retrieval, fingerprint comparison, and signature verification are confirmed. | Issuer trust, revocation, rotation, lifecycle governance, and trust-list policy are deferred. |
| Registry | Exact hash recovery behavior is confirmed. | Registry SLOs, monitoring, retry policy, incident response, rollback, and identity authority are not validated. |

## Provider and issuer non-claims

A source hash, certificate URL, certificate fingerprint, or valid signature
does not independently prove provider origin or authorized-issuer status.

Provider-origin claims would require a separately designed and verified
provider-controlled signature and provider public-key trust boundary. Issuer
authorization would require governance for identity, scope, enrollment, trust
ownership, suspension, revocation, and verifier behavior. Neither exists in
the current audited scope.

## Deferred production controls

The following remain explicit exclusions:

- production certificate issuer trust, revocation, rotation, and lifecycle
  governance;
- production key management and credential isolation;
- a full canonical-CBOR profile and decoder bounds;
- broader cryptographic-profile decisions, including P-256 and HMAC/HKDF;
- formal provider, issuer, and `generating_id` identity semantics; and
- registry operational controls: SLOs, monitoring, retry policy, incident
  response, and rollback.

No production deployment approval follows from successful reference-
implementation audit evidence.

## Review posture

A security review should keep four questions separate:

1. Is the envelope structurally valid and authenticated?
2. Does the received visible text bind to that record?
3. If no usable carrier exists, is there only an exact-hash recovery record?
4. Are production trust, identity, and operational controls separately
   established?

Only the first two can produce in-band verification. The third is explicitly
degraded recovery; the fourth remains out of scope for the current reference
implementation.
