# LINGUISTIC PROVENANCE SCHEMA (LPS)
### A proposed text profile for C2PA: span-level AI-contribution provenance

**Status:** v0.1 draft for working-group review
**Author:** Brayan Daniel Rodriguez Lugo
**Contact:** rodriguezlugobrayandaniel@gmail.com
**Date:** June 2026

---

## ABSTRACT

C2PA records that AI was involved in producing an asset. It does not
record how much, which parts, or in what manner. LPS is a proposed
C2PA assertion schema that records, at the level of spans within a
text, what proportion was human-authored, AI-generated, or human text
subsequently modified by AI — together with a confidence and, for
modified spans, a degree of modification. LPS introduces no new
signing, embedding, storage, or trust machinery. It reuses C2PA's
existing text embedding methods, claim-signature format, manifest
repository, soft-binding resolution, time-stamp authority integration,
ingredient model, and trust list. Its only contribution is the
assertion schema, the confidence source contract, the mathematical
confidence fallback mechanism, and the small technical extension
required to make C2PA assertions address sub-asset spans of text
rather than whole assets. LPS is designed to be layered with C2PA
file metadata and with statistical watermarking (e.g. the SynthID
class); it is not a replacement for either.

---

## 2. PROBLEM STATEMENT

An origin claim about a text is today asserted but not testable,
and the cost of a false claim falls on a third party who had no
way to check. Three concrete harms follow.

**False authorship in official documents.** A filing, statement, or
affidavit presented as human-authored may be wholly or partly
machine-produced, with no persistent signal of which.

**Credential and identity fraud.** Written work samples, claimed skills,
and qualifications can be AI-generated and passed off as a person's
own capability.

**Institutional vetting failure.** A company hiring, an editor publishing,
or a regulator reviewing is forced to accept a document with no
provenance and no means to test the origin claim.

The technical root is the export gap, demonstrated by the HaLLMark
research (Hoque et al., CHI 2024): AI contribution can be tracked
while writing, but once accepted the AI-originated text is visually
indistinguishable from human text, and on export the record
disappears. No shipped standard fills this gap at sub-document
granularity.

---

## 3. RELATIONSHIP TO C2PA

LPS is a text profile, not a parallel system. Stated explicitly:

**Reused unchanged:**
- Text embedding methods (variation-selector and
  structured/distributed carriers).
- Claim-signature format and time-stamp authority integration.
- Manifest repository and soft-binding resolution (used here
  for text recovery).
- Ingredient model (used here for multi-round provenance).
Trust list (specified for both signing and registry write
  authorization; not yet implemented in the v0.1 reference
  implementation — the registry stub currently uses a single
  service-role credential as its access boundary. See §8.9).

**Extended:**
- Assertion target moves from whole-asset to sub-asset spans
  of text (offset- or hash-anchored ranges).

**Added (the contribution):**
- A standardized assertion schema for granular AI-contribution
  provenance: per-span origin (human / ai_generated /
  ai_modified_human), confidence, modification degree, and the
  derived overall human/AI proportions.

- A confidence source contract defining the AI tool as the primary and authoritative source of confidence values, with a defined fallback hierarchy and a mathematical derivation method when no tool-supplied value is available. An explicit algorithm-naming convention: the manifest's algorithm field carries the value es256, matching the JOSE alg value ES256 in lowercase, identifying ECDSA P-256 with SHA-256 and IEEE P1363 raw r‖s signature encoding. This is a naming convention internal to LPS, not a claim that the manifest is itself a COSE or JOSE structure — see §8.8.

- A redundant embedding architecture (PROPOSAL 005) providing
  anchor manifests at paragraph boundaries and overlapping full
  manifest copies with cross-copy reconstruction, increasing
  signal survival across partial copy, signal stripping, and
  adversarial removal scenarios.

**Verification state model — eight states:**
- **verified** — signal intact, signature valid, text hash matches.
- **failed** — signal found but signature invalid or text modified.
- **degraded** — signal absent, no registry record.
- **registry_required** — signal absent, registry record found.
- **anchor_only** — no full manifest recoverable, anchor manifests
  present and valid. Returns document-level fields only.
- **partial_recovery** — manifest partially reconstructed from
  surviving chunks across redundant copies. Returns
  reconstruction completeness percentage and gap map.
- **injection_detected** — conflicting certificates found across
  chunk assemblies. Returns both certificate fingerprints
  as forensic evidence of adversarial injection attempt.
- **reconstruction_corrupted** — checksum mismatch on buffer
  assembly after cross-copy reconstruction.

---

## 4. ARCHITECTURE

### 4.1 Bindings

LPS uses two binding types, in C2PA's vocabulary. A hard binding:
SHA-256 of the visible text, computed at signing time and
re-computed at verification time; exact, breaks on any byte change.
A soft binding: the invisible carrier embedded in the text, which
survives copy-paste but not lossy reproduction. The signed manifest
travels in the soft binding; the hard binding is what the recovery
registry indexes.

### 4.2 Confidence source contract

The generating AI tool is the authoritative source of confidence.
When an AI tool produces or modifies a span, its API response must
supply the confidence value for that span directly. This is the only
source that reflects first-person certainty about the origin
classification. No other source supersedes it.

When the generating tool does not supply a confidence value, the
following sources are used in priority order:
1. Output from an approved AI detection classifier, mapped 0–100.
2. Human reviewer manual assignment, integer 0–100.
3. Mathematical fallback derivation.

Mathematical fallback: when no confidence value is supplied,
the system calculates an approximation from the document's segment
character distribution. For each origin type, the fallback confidence
equals the percentage of total document characters belonging to that
origin type, floored to the nearest integer. Example: a document
where 81.66% of characters are AI-generated produces a fallback
confidence of 81 for AI-generated segments. This value is a
structural approximation, not a forensic measurement. Every segment
in the manifest carries a confidence_source field recording whether
the value came from the tool, a classifier, a human reviewer, or
the mathematical fallback. This field survives compression,
embedding, and verification intact.

### 4.3 Redundant embedding architecture

To increase signal survival across partial copy, adversarial
stripping, and platform normalization scenarios, LPS implements
a two-layer redundant embedding architecture.

**Layer 1 — Anchor manifest:** a minimal manifest containing
document-level fields only (text_hash, overall_ai_proportion,
human_proportion, algorithm, signed_at) is embedded at the start
of every paragraph using the A.8 carrier method. Anchors are
HMAC-protected to prevent forgery. Anchors survive short copies
and provide the document-level provenance picture independently
of the full manifest.

**Layer 2 — Overlapping redundant full manifest copies:** one complete
signed manifest copy is embedded per paragraph using the A.9
distributed carrier method. Adjacent copies overlap by 25% of
their chunk range. Each chunk carries a positional header
(sequence number, total count, copy identifier, type flag) so
surviving chunks from damaged copies can be identified and
combined across copies to reconstruct the full manifest even
when no single copy survived intact.

Reconstruction logic: the verifier collects all surviving chunks,
groups by sequence number across all copies, fills gaps in one
copy using matching sequence positions from other copies, and
validates the assembled buffer via a SHA-256 checksum stored in
the first chunk. The number of complete copies scales automatically
with document length — longer documents carry more redundancy.

### 4.4 Defense-in-depth across four channels

**Channel 1 — copy-paste** (carrier and visible text both preserved).
Defended by the embedded signed manifest. Deterministic,
returns verified.

**Channel 2 — targeted strip** (visible text preserved byte-for-byte,
carrier removed). Defended by registry lookup on the recomputed
content hash. Deterministic. Further defended by anchor manifests
at paragraph boundaries which may survive partial stripping.

**Channel 3 — lossy reproduction** (OCR, photograph, retype; visible
bytes changed). Not covered by LPS. This is the domain of
statistical watermarking, which survives in word choice rather
than in characters.

**Channel 4 — heavy rewrite.** Irreducible residual; no provenance
layer reliably survives.

### 4.5 The four-cell verification matrix

- Carrier survived, bytes preserved → verified.
- Carrier survived, bytes edited → failed, with the original signed
  manifest returned (proof of alteration plus the original claim).
- Carrier stripped, bytes preserved exactly → registry recovery
  by content hash.
- Carrier stripped, bytes edited → unrecoverable. The honest residual.

This matrix describes the baseline system. The redundant embedding
architecture (§4.3) extends Channel 2 defense and introduces
partial recovery paths not captured by the four-cell model.

---

## 5. THREAT MODEL

A provenance system exists only because origin will be lied about.
Named adversaries:

**Strip** (remove carrier, leave text intact) — DEFENDED by registry
hard-binding recovery and anchor manifest survival at paragraph
boundaries.

**Forge** (fabricate a record claiming false origin) — DEFENDED:
a forged signature does not validate against the trust list.
Anchor HMAC protection prevents anchor forgery without the
private key.

**Transfer/replay** (lift a valid signal onto different text) —
DEFENDED: the text-hash binds the manifest to its specific
visible text; verification returns failed. The failed state
returns the original manifest only when the received text
length is within 10% of the signed text length, preventing
the original manifest from being leaked to an adversary
studying document structure via extreme-mismatch replay.

**Impersonation** (sign as an issuer one is not) — SPECIFIED, not yet
  enforced: the trust list mechanism that would defend against
  this is architecturally defined but not implemented in v0.1.
  See §8.9.

**Truncation** (present only the latest round, hide that earlier
rounds existed) — OPEN: undetectable from the text alone;
requires the registry to hold the chain. See §7.

**Manifest injection via foreign certificate** (adversary generates
own keypair, injects chunks with a valid but untrusted
certificate into a legitimately embedded document) — DEFENDED:
the verifier pins the certificate from the first valid assembly
as the session anchor. Any subsequent assembly producing a
different certificate is flagged as injection_detected with
both certificate fingerprints recorded as forensic evidence.

**Anchor substitution** (adversary replaces anchor manifests with
falsified proportions) — DEFENDED: anchor HMAC validation
discards anchors whose HMAC does not verify against the
signing key derivation. Stripped anchors are recorded as
anchor_layer: absent in the verified output — forensically
significant even when the full manifest survived.

**Registry poisoning** (adversary floods registry with fake records)
— DEFENDED: content hash format validation, generating_id
format validation, and rate limiting applied before every
registry insert. Supabase is never called on invalid input.

**Magic prefix collision** (adversary crafts buffers that match
the LPS magic prefix by chance or design) — DEFENDED:
secondary validation after magic prefix match confirms
type field is 0 or 1, version field is 1, total field
is greater than 0. Injection volume cap discards excess
buffers beyond the expected count for the document size.

**Carrier-as-injection-channel** — ADDRESSED, see 5.1.

### 5.1 The injection duality

The invisible carrier is mechanically identical to a documented
prompt-injection channel: invisible Unicode that a language model
may interpret as instructions. LPS turns this into a defense rather
than a liability. An input filter extracts any invisible payload
and checks for a valid LPS signature: signed data is legitimate
provenance and passes; unsigned invisible data in the dangerous
classes (notably Unicode tag characters) is stripped before the
model reads it, and flagged. The attacker cannot satisfy the
filter, because they cannot produce a signature trusted by the
trust list. The absence of a valid signature is the trigger.
This is a defensive contribution to a publicly documented attack
class, not a new vulnerability. The HMAC-protected anchor layer
provides an additional verification signal — anchors present
without valid HMAC are evidence of injection attempts even before
signature verification runs.

---

## 6. DEMONSTRATION

A reference implementation produces and verifies LPS manifests
end to end. The pipeline is four stages: manifest generation
(segments → JSON manifest with text-hash, derived proportions,
and confidence_source per segment), signing (canonical-CBOR bytes
signed with ECDSA P-256, certificate delivered by public URL plus
fingerprint), embedding (compressed CBOR manifest in the text
carrier with redundant copies per paragraph), and verification
(eight states).

Verified in memory: a freshly embedded text returns verified,
with the recomputed clean-text hash matching the signed text-hash
exactly, and the signature validating over canonical CBOR
(encoding independent of key order, resolving the
implementation-dependent-verification weakness identified in
independent C2PA analysis). Signatures use the IEEE P1363 raw r‖s
encoding specified by the ES256 algorithm identifier — confirmed
via internal round-trip testing and an independent cross-check
against the panva/jose library, an unrelated, spec-validated
JOSE implementation with no shared code path. This confirms the
underlying signature primitive (curve, hash, byte encoding) is
genuinely spec-compliant, not merely self-consistent within this
codebase. The manifest is not currently wrapped in a COSE_Sign1
or compact JWS envelope; full envelope-level interoperability is
identified as a post-v0.1 target — see Section 8. Signatures are produced using
ES256 over the P-256 curve with SHA-256, encoded using
IEEE P1363 r‖s format rather than Node's default DER encoding.
This has been validated through internal round-trip verification
and independently confirmed via interoperability testing using
the panva/jose library, where the signature was successfully verified
when placed inside a standard compact JWS structure using default
ES256 verification behavior. This demonstrates compatibility of the
underlying signature primitive and encoding choice with standard
ES256 verification tooling. However, LPS does not currently emit a
JWS or COSE_Sign1 envelope; signatures are carried alongside a
custom compressed manifest format. Full envelope-level
interoperability is explicitly deferred to v0.2 (see Section 9).

All eight states reproduced live: an unedited round-trip returns
verified; adding a visible character returns failed with the
original manifest; deleting into the carrier region returns
degraded; a stripped-but-exact text returns recovery from the
registry; a document with stripped anchors but intact manifest
returns verified with anchor_layer: absent; a partially copied
document returns anchor_only or partial_recovery depending on
how many chunks survived; an injected foreign-certificate chunk
set returns injection_detected.

Carrier-survival across real transports is in progress: editors
that preserve invisible variation selectors (observed directly
in one major web word processor, where the carrier manifests as
a cursor that steps over the invisible cluster) preserve the
signal; transports that normalize Unicode on paste do not. A
measured transport matrix accompanies this submission as
empirical evidence rather than assertion.

*[Note to you: run the survival matrix with the test rig and paste
the measured cells in here before submission. Paste the four real
JSON outputs into Appendix A before submission. This section is
strongest as a table of real results.]*

---

## 7. PRIOR ART COMPARISON

| Capability | C2PA | SynthID | HaLLMark | LPS |
|---|---|---|---|---|
| Sub-document granularity | No | No | tracking only, no export | Yes |
| Cryptographic binding | Yes | No | No | Yes |
| Carrier survival copy-paste | Yes | Yes | No | Yes |
| Registry recovery after strip | Yes | No | No | Yes |
| Confidence scoring per span | No | No | No | Yes |
| Modification degree per span | No | No | No | Yes |
| Redundant embedding with reconstruction | No | No | No | Yes |
| Lossy reproduction survival | No | Yes | No | No |

---

## 8. OPEN QUESTIONS WITH PROPOSED DIRECTIONS

These form a single family — temporal validity and provenance
chaining across key and edit lifecycle events — and are presented
together rather than as scattered gaps.

### 8.1 Recovery registry in production

The registry is a recovery index, not the source of truth; the
signed embedded manifest is. The registry recovers provenance
only for Channel 2 (exact text, stripped carrier). Proposed
direction: structure it as a Certificate-Transparency-style
append-only log, serving the role of a C2PA manifest repository
for text, queried via a soft-binding-resolution-equivalent path
keyed on the visible-text hash. Access: public read (verification
is a public good), trust-list-gated write (one trust mechanism
for signing and registration), every query logged with consumer
notice per C2PA privacy guidance.

### 8.2 Revocation, certificate expiry, emergency rotation

A provenance record cannot be revoked; a signing key can.
Proposed direction: append-only, versioned, immutable certificates
(added, never replaced, never deleted), so any past document can
always fetch the exact certificate that signed it, confirmed by
fingerprint. Trusted timestamping (RFC 3161, adopting C2PA's
existing COSE time-stamp authority integration) then resolves
three things at once: legal-grade "when," before/after
determination for revocation so honest pre-compromise signatures
survive, and expiry semantics so a signature made while a
certificate was valid remains verifiable after expiry.

### 8.3 Multi-round provenance

Reuses C2PA's ingredient model: each editing round emits a
manifest asserting the prior manifest's hash as an ingredient.
Because text cannot carry a long chain within the byte ceiling,
the carrier holds the latest manifest plus the parent hash-link,
and the registry holds the chain. The genuinely unsolved problem,
named precisely as the primary post-v0.1 research item: span
survival under editing. Offset-anchored spans break when a later
round inserts or deletes text. Two candidate directions, neither
clean — anchor spans to a hash of their own text (survives
reordering, breaks on in-span edits), or re-segment each round
and preserve provenance only at the manifest-chain level (robust,
loses per-span lineage). Truncated chains are undetectable from
text alone and depend on the registry holding the full chain.
Chain depth limit and poisoned chain detection are open
architectural questions proposed for working group resolution.

### 8.4 Segment boundary granularity

The system requires the generating AI tool to report segment
boundaries at generation time. The granularity at which boundaries
must be reported is not yet defined. Proposed direction: sentence
level as the minimum required granularity. Word level is too
granular for reliable tool reporting. Paragraph level loses
forensic precision. Sentence level balances practical
implementability with forensic utility. This definition is
required before working group submission and before third-party
tool integration can begin.

### 8.5 Confidence source and fallback

The AI tool is the authoritative source of confidence values.
The mathematical fallback defined in §4.2 is a structural
approximation. The forensic weight a court or institution should
assign to fallback-derived confidence values versus tool-supplied
values is an open legal and evidentiary question proposed for
working group input. The confidence_source field in the manifest
ensures the distinction is always preserved and visible to
verifiers.

### 8.6 Identity and privacy

The registry stores content hashes, not content, so it is likely
outside personal-data scope. The generating-identity field is the
exception: depending on what it encodes, it may be personal or
pseudonymous data. This is flagged as an open data-protection
question, not asserted clean.

### 8.7 Cross-registry governance
Jurisdiction, liability for false-positive matches, and retention
are open governance questions, proposed to follow Certificate
Transparency's governance precedent.

8.8 Envelope-level signature interoperability
The reference implementation's signature primitive (ECDSA P-256,
SHA-256, IEEE P1363 raw r‖s encoding) has been confirmed
interoperable with standard JOSE/COSE tooling at the primitive
level via independent library cross-check. The manifest itself is
not currently packaged inside a standard signing envelope —
no COSE_Sign1 structure, no compact JWS. A party with off-the-shelf
COSE or JOSE tooling cannot today parse and verify an LPS-signed
manifest directly; they would need an LPS-aware adapter even
though the underlying signature would validate. Proposed direction:
adopt a COSE_Sign1 envelope for v0.2, since C2PA's own claim-
signature format is already COSE-based and this would close the
gap between "uses a C2PA-compatible primitive" and "is structurally
a C2PA-compatible artifact." Working group input requested on
priority and whether v0.1 submission should wait for this or
proceed with the primitive-level interoperability as currently
demonstrated.

### 8.8 Envelope-level signature interoperability

The reference implementation's signature primitive (ECDSA P-256, SHA-256, IEEE P1363 raw r‖s encoding) has been confirmed interoperable with standard JOSE/COSE tooling at the primitive level via independent library cross-check. The manifest itself is not currently packaged inside a standard signing envelope — no COSE_Sign1 structure, no compact JWS. A party with off-the-shelf COSE or JOSE tooling cannot today parse and verify an LPS-signed manifest directly; they would need an LPS-aware adapter even though the underlying signature would validate. Proposed direction: adopt a COSE_Sign1 envelope for v0.2, since C2PA's own claim- signature format is already COSE-based and this would close the gap between "uses a C2PA-compatible primitive" and "is structurally a C2PA-compatible artifact." Working group input requested on priority and whether v0.1 submission should wait for this or proceed with the primitive-level interoperability as currently demonstrated.

### 8.9 Trust list implementation status
The trust list described in §3 as reused C2PA infrastructure is
architecturally specified but not yet implemented in the v0.1
reference implementation. The registry stub (§6.1, PROPOSAL 001)
currently uses a single Supabase service-role credential as its
write-access boundary — a placeholder, not a trust list. A real
implementation requires defining how signing and registry-write
authority are granted and revoked, which is buildable now without
external dependency and is planned ahead of working group
submission, separate from PROPOSAL 005.
---

## 9. LIMITATIONS

LPS proves the integrity of an origin claim, not its truth.
A verified record means the claim is authentic, signed by a
known issuer, and unaltered — not that a human "really" wrote
the human-attributed spans. It records what the signing tool
asserted at signing time. It does not independently establish
individual authorship unless issuer identity was itself verified
through the trust list.

LPS requires generation-time cooperation from the producing tool
(the same requirement C2PA and SynthID carry) and, for the
registry and any statistical-watermark layer, from model
providers. It does not survive lossy reproduction or heavy
rewrite (Channels 3 and 4).

The confidence fallback mechanism (§4.2) produces an approximation
derived from document-level character distribution, not a
signal-strength measurement. Manifests carrying fallback-derived
confidence values should be weighted accordingly in forensic
contexts. The confidence_source field makes this distinction
explicit and machine-readable.

The partial_recovery and anchor_only states represent incomplete
provenance recovery. A partial_recovery result means the full
segment breakdown could not be reconstructed — only the portions
that survived across redundant copies are returned. An anchor_only
result means only document-level fields survived. Neither state
should be treated as equivalent to verified. The
reconstruction_completeness percentage in partial_recovery
provides a quantitative measure of how much of the provenance
record is present.

These boundaries are stated so they are not discovered
adversarially.

---

## APPENDIX A — VERIFICATION OUTPUT, EIGHT STATES

*[Paste the actual JSON outputs from the reference implementation
for all eight states before submission:*
- *verified*
- *failed (with original_manifest)*
- *degraded (with anti-forensic note)*
- *registry_required (with registry record)*
- *anchor_only (with anchor fields)*
- *partial_recovery (with reconstruction_completeness and gap map)*
- *injection_detected (with both certificate fingerprints)*
- *reconstruction_corrupted]*

---

## APPENDIX B — PLAIN-LANGUAGE FORENSIC REPORT (worked example — illustrative, not an actual case)

*(worked example — illustrative, not an actual case)*

**What was examined.** A text document, identified by content hash
c09319f5…d187a, received on 25 June 2026.

**What was found.** A provenance record was present in the document
and cryptographically intact. The record was signed by [issuer,
per trust list] on [signing time, per trusted timestamp]. The
visible text matches the text recorded at signing; it has not
been altered since.

**What it means.** The record states the text is 100% human-authored
across one span, classified with 95% confidence from the
generating tool. This means the signed origin claim is authentic
and unaltered. It does not by itself prove a specific individual
wrote the text; it proves the issuing tool recorded this origin
at signing time and that the record has not been tampered with.

**Confidence and limitations.** This finding establishes the integrity
of the origin claim, not its truth. Absence of such a signal in
other documents would not be evidence of human authorship; signals
can be removed by retyping, reformatting, or character
normalization. A classification at 95% confidence should be
weighed as a probability contribution, in the manner of other
digital-forensic evidence, not as a standalone verdict. Where
confidence_source is fallback rather than tool, the confidence
value is a mathematical approximation and should be weighted
accordingly.

**Chain of custody.** The document was received as [source]; its hash
was computed on receipt and is recorded above.

**Variant — failed:** "The text examined differs from the text
recorded at signing time — it has been changed since the record
was made. The original record claimed the following: [original
manifest fields]. The difference between the received text length
and the signed text length determines whether the full original
record is disclosed or withheld for security reasons."

**Variant — degraded:** "No provenance signal could be recovered.
The text may never have carried one, or it was removed. Absence
is not evidence of human authorship and is itself forensically
significant — a document that arrives with all provenance
removed made a deliberate or incidental effort to obscure its
origin."

**Variant — registry_required:** "No signal was found in the text,
but a matching record was located in the provenance registry by
content hash, indicating text with identical content was
registered on [date] by [issuer]. The carrier was stripped after
registration."

**Variant — anchor_only:** "No full provenance record was recoverable.
Partial records were found at paragraph boundaries confirming the
document was signed on [date], with an overall AI proportion of
[value] and human proportion of [value]. The segment-level
breakdown is not available."

**Variant — partial_recovery:** "A partial provenance record was
recovered from [reconstruction_completeness]% of the embedded
signal. [N] of [expected_segment_count] segments were
reconstructed. The remaining segments were unrecoverable. The
recovered record should be treated as incomplete. Full
verification could not be performed."

**Variant — injection_detected:** "An adversarial injection attempt
was detected. A legitimate provenance record was found alongside
a second record carrying a different certificate. Both certificate
fingerprints are recorded as forensic evidence. The legitimate
record is [session_cert_fingerprint]. The injected record is
[injected_cert_fingerprint]."

---

## 10. VERIFY BEFORE SUBMISSION

*[internal — remove before sending]*

1. Confirm no existing C2PA span-level contribution assertion (§3).
2. Confirm current C2PA spec version and exact assertion
   vocabulary; align terms.
3. Confirm RFC 3161 / COSE time-stamp authority is the current C2PA mechanism to cite (§8.2).
3a. Confirmed June 30 2026 — ES256 signature encoding (IEEE P1363 raw r‖s) verified interoperable at the primitive level with the independent panva/jose library. Envelope-level (COSE_Sign1/JWS) interoperability remains open — see §8.8. Decide before submission whether v0.1 proceeds with primitive-level interoperability stated as-is, or whether envelope adoption should be completed first.
4. Confirm current EU AI Act Article 50 dates and the
   marking-guidance instrument names.
5. Paste measured transport-matrix results (§6) and all eight
   real JSON outputs (Appendix A).
6. Resolve author institutional affiliation — confirm whether
   Act-quiere or Systemactic is the correct entity to list and
   add contact URL.
7. Confirm prior art comparison table (§7) is accurate against
   current published capabilities of C2PA, SynthID, and HaLLMark.
