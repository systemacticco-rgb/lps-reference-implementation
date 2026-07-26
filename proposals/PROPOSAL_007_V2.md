## PROPOSAL 007 — Cooperative Span Marker System

---

```
PROPOSAL 007 — Cooperative Span Marker System
Status: [PROPOSED] — under architectural definition
Date: 2026-07-20
Author: Systemactic
Relates to: LPS v0.1, PROPOSAL 005 (A.8R), C2PA Text specification
Does not replace: A.8 carrier, LPS v0.1 manifest pipeline
License: CC BY 4.0 (this document)
```

---

## Problem

[RESEARCH] Machine-readable text signals may enable participating crawlers and training pipelines to identify, exclude, downweight, or separately handle marked content. They may support data-curation strategies that separately treat model output; they do not establish a causal effect on model collapse or prevent it.

[LAW / COMPLIANCE] Article 50 is an external adoption and compliance context for evaluating interoperable machine-readable marking. It does not validate or certify this carrier, and the Code of Practice is voluntary. Provider adoption, regulator interpretation, and the applicable disclosure obligation remain external dependencies.

---

## What This Proposal Is Not

This proposal does not replace LPS v0.1, the A.8 carrier, or the cryptographic manifest pipeline. It is not a deployed or forensic-grade system. It does not provide cryptographic integrity, issuer authentication, provider authentication, or proof of AI origin. It does not eliminate adversarial removal or forgery.

[PROPOSED] This proposal is a cooperative invisible-Unicode signalling layer for claimed text-span classification. Its value depends on provider adoption and on the preservation and interpretation decisions of transport, renderer, crawler, and training-pipeline operators.

---

## What This Proposal Does

[HOLD] The AI-only model is operative. Human span markers, per-span ordinal fields, and per-span total-count fields are removed. The document-level header carries the total AI-span count. Ordinal-level gap localization is not available under the header-only model.

[SECURITY / LIMITATION] A scanner that recognises a complete published grammar can classify text as carrying a claimed cooperative signal. Invisible Unicode alone establishes neither AI origin nor malicious intent; a recognised grammar cannot authenticate an issuer, provider, or author.

[LIMITATION] No registry or cryptographic key is part of PROPOSAL 007. A missing marker establishes neither stripping, intent, nor human authorship. Registry recovery in the LPS portfolio is separately limited to an exact visible-text hash with an existing generation-time record; it cannot restore missing span-level evidence.

---

## Marker Design

### Codepoint Selection

[PENDING CROSS-CHECK / SECURITY] The approved codepoint library is U+2060–U+2064: U+2060 is the structural identifier; U+2061 is the AI span type identifier; U+2062 and U+2063 are open and close directions; U+2064 is the header type discriminator and base-5 digit value 4. No codepoint outside this library is valid at a Proposal 007 grammar position. Invalid occurrences of U+2060–U+2064 are discarded and do not contribute to a calculation. The tag block U+E0000–U+E007F, U+200B–U+200D, U+2065–U+206F, BMP PUA, variation-selector supplement, and directional controls are excluded.

[PENDING CROSS-CHECK] Renderer, IDE, sanitizer, browser, and transport behaviour for the approved library remains unconfirmed beyond the scoped test tool. Coexistence with an A.8 manifest is a candidate design assumption, not an interoperability or survival claim.

### Compound Marker Sequences

A single codepoint marker can collide with legitimate invisible mathematical or formatting content. The operative span grammar uses three-codepoint markers:

```
Role order:      structural wrapper | type | direction
AI span open:    U+2060 U+2061 U+2062
AI span close:   U+2060 U+2061 U+2063
```

Human span markers are not part of the main grammar.

### Byte Cost

Each AI span marker is 3 codepoints and 9 bytes; an open-close pair is 18 bytes. The document header is 5 codepoints and 15 bytes. At 99 pairs, the payload ceiling is 1,797 bytes.

### Ordinal Sequencing

[HOLD] Per-span ordinal and total-count fields are removed. The document-level header is `U+2060 U+2064 [D1] [D2] [D3]` and carries the total AI-span count. Its three base-5 digits encode values 01–99 using U+2060–U+2064. One valid header is recorded per document scan; the first is authoritative. Ordinal-level gap localization is not available under this design.

### Optional Variants

[PROPOSED] The following are documentation-only fallbacks. No variant is promoted by the current findings.

#### Variant 007-A — AI spans only

Documentation-only fallback. The operative grammar is AI-only and does not treat unmarked text as human-authored.

#### Variant 007-B — One-codepoint span markers

Documentation-only fallback. No one-codepoint marker is selected for the operative grammar.

[SECURITY / LIMITATION] A provider-adopted one-codepoint variant would still be forgeable; malicious actors could inject codepoints inside otherwise valid spans.

#### Variant 007-C — Header total-count markers

Documentation-only fallback. The operative grammar includes a document-level header carrying the total AI-span count.

---

## Implementation Mechanism

### Reference and Provider Scope

[PROPOSED] PROPOSAL 007 is not deployed. Provider-facing marking depends on provider cooperation. If an AI provider's output contains no header, the LLM must place the document-level header at the beginning of the generated text. No provider-integration cost, deployment schedule, or cross-provider interoperability is established.

[HOLD — LANGUAGE MIGRATION] JavaScript/Node.js remains a reference implementation environment. Runtime throughput, typed integration contracts, binary hash representation, CPU concurrency, and cross-language transport are production dependencies; they do not block a working-group submission, but they do block production-deployment or commercial-SLA claims.

### What AI Providers Should Change

[HOLD] Providers must use the defined AI span grammar and document-level header. Provider cooperation is an external dependency, not a property that this proposal can enforce.

### Arbitrary Position Placement

[HOLD] Markers, if adopted, would need placement at defined span boundaries. The PROPOSAL 005/A.8R wrapper-level arbitrary-position concept is separate, remains unimplemented, and is complementary redundant-manifest research for LPS v0.1—not an independent system or C2PA Text A.9.

---

## Verification

### What a Verifier Does

[HOLD / PENDING CROSS-CHECK] The verifier normalizes the input before scanning: it strips a leading U+FEFF at position 0 and trailing U+0020, U+000A, and U+000D codepoints, logging their hex values and count. It scans the approved library, records the first valid document header, and matches valid AI open and close markers in document order. E001–E011 are the complete verifier output.

### Verification Semantics

| Condition | Required verifier result |
|---|---|
| Valid header and valid AI pairs survive | Report surviving pairs, header total, and survival rate = pairs ÷ header total. |
| Valid header survives and zero AI pairs survive | Report the header total as a generation-time signal; state that the header is present and no span signal survives. Do not infer stripping. |
| No valid header and valid AI pairs survive | Report surviving pairs; state that the generation-time total is unknown and survival rate is not computable. |
| No valid header and no valid AI pairs survive | Return `NO_VALID_MARKDOWN_FOUND`. Do not infer stripping or provenance. |
| Standalone U+2060 fails the position-1 type check | Discard it without reporting or including it in a calculation. |

### What the Output States

[SECURITY / LIMITATION] A verifier may report a recognised grammar as a claimed cooperative signal. It cannot report cryptographic provenance, issuer identity, provider identity, authorship, or AI origin. Markers are removable and forgeable.

[LIMITATION] A document with no surviving markers has an absent signal; that absence does not establish stripping, intent, or human authorship.

### Damage Degree Reporting

[HOLD] Excess opens and closes are orphaned markers (E007 and E008) and are not counted as valid pairs. Internal approved-library codepoints at non-marker positions within a valid pair trigger INTERNAL_SIGNAL (E009); the pair remains valid and counted. Surviving valid pairs exceeding the header total trigger IMPOSSIBLE_COUNT (E010); the pairs are not suppressed.
---

## Survival Characteristics

### Scoped Test State

[IMPLEMENTED — SCOPED] The browser matrix is a 45-card render test. Layout survival at 12px and 15px is confirmed clean; those cards are removed for test efficiency. Nine 18px bidi cards—three Arabic, three Hebrew, and three Persian—are added. The tool is a render test with an attached embed–copy–verify utility. It is not a validated round-trip test until T.Clipboard instrumentation confirms post-clipboard codepoint-array integrity and embedding-dropdown decoupling is implemented.

[PENDING CROSS-CHECK] This tool does not establish injection, platform-survival, or interoperability claims. Compound three-codepoint round trips; pasted-codepoint instrumentation; messenger, social-media, Windows, mobile, LLM API, GitHub, IDE, sanitizer, scraper, and renderer transit remain to be tested.

### Known Stripping and Rendering Limits

[PENDING CROSS-CHECK / SECURITY] Session research identifies U+2060–U+2064 as targeted by at least one LLM-gateway stripping rule; source citation remains pending. Transport, sanitizer, scraper, mobile, and application-specific stripping behaviour is not a final claim.

### Stripping and Adversarial Removal

[SECURITY / LIMITATION] PROPOSAL 007 markers are removable and forgeable. A recipient may preserve them, remove them manually, use automated stripping, or treat them as a disclosure signal. A smaller carrier’s survival, removability, and forensic assurance are separate measurements; no removal deterrence or forensic conclusion follows from this proposal.

[RESEARCH] The frequency and cost of preservation or removal choices, including crawler and training-pipeline treatment, require behavioural and transport research.
---

## Relationship to LPS v0.1

[PROPOSED] LPS v0.1 remains the dominant long-term signed-manifest system and the only portfolio layer making a cryptographic-integrity claim. PROPOSAL 007 is a complementary, lowest-assurance cooperative marker mechanism; it does not replace LPS v0.1.

[SECURITY / LIMITATION] A.8 and the proposed A.8R carrier retain the Unicode-conformance concern identified for the C2PA unstructured variation-selector scheme. This is a carrier, standards, and adoption limitation; it is not a claim that LPS’s cryptographic signature layer is invalid.

[LIMITATION] LPS registry recovery can corroborate only an exact visible-text hash with an existing generation-time record. It does not restore missing span-level evidence. PROPOSAL 007 has neither a registry-recovery path nor a signature.

[PENDING CROSS-CHECK] A document may be designed to carry both A.8 and PROPOSAL 007 markers, but transport preservation, renderer behaviour, coexistence, and verifier interpretation remain external dependencies rather than established outcomes.
---

## Regulatory and Economic Framing

[RESEARCH] Cost, market, penalty, adoption, and registry-operating figures require primary citations before being used as confirmed framing. No implementation-cost or deployment benefit is established here.

### The Collaborative Path

[PROPOSED] Provider adoption and crawler or training-pipeline interpretation are cooperative external dependencies. The grammar defines conforming behavior; it does not enforce conformance.

---

## Open Questions — Requires Working Group Input

- **[HOLD] Header scope beyond a document.** A document-level header cannot distinguish independently generated sections in a multi-section web page. Per-paragraph header scoping remains open.

- **[HOLD] Lens 200 boundary.** Embedding positions for inputs longer than 200 visible characters are undefined. This is a testing-tool concern only.

- **[RESEARCH / PENDING CROSS-CHECK] Collision and security handling.** Mathematical-content collisions, LLM spontaneous-output collision rates, and scanner, sanitizer, or scraper handling require reproducible testing and source discipline.

- **[PENDING CROSS-CHECK] Transport and renderer behaviour.** Compound round-trip survival, messenger, social-media, Windows, mobile, LLM API, GitHub, IDE, browser, and renderer transit remain unconfirmed.

- **[SECURITY] Signal interpretation.** The completed grammar must retain the boundary that it supports recognition of a claimed cooperative signal, not authentication of AI origin, issuer, provider, or author.

---

## What Has Been Built

[IMPLEMENTED — SCOPED] `test-proposal-007-markers.html` is a browser render test with an attached embed–copy–verify utility. It is not a validated round-trip test until T.Clipboard instrumentation confirms post-clipboard codepoint-array integrity and embedding-dropdown decoupling is implemented.

[PENDING CROSS-CHECK] Compound-sequence survival and all cross-platform transit results remain open.

---

## Implementation Status

```
Marker design:          [HOLD] AI-only grammar defined
Codepoint selection:    [PENDING CROSS-CHECK / SECURITY] Approved library U+2060–U+2064
Compound sequence:      [HOLD] Defined AI open and close markers
Human-span policy:      [HOLD] Human markers removed from main grammar
Ordinal/header scheme:  [HOLD] Document-level header; no per-span ordinal or total count
Verifier logic:         [HOLD / PENDING CROSS-CHECK] Deterministic header and pair verification defined
Test tool:              [IMPLEMENTED — SCOPED] Render test with attached embed–copy–verify utility
Provider integration:   [PROPOSED] Requires external provider cooperation
Runtime status:         [HOLD — LANGUAGE MIGRATION] JavaScript reference only
A.8R relationship:      [PROPOSED] Complementary LPS redundancy research; not C2PA Text A.9
```

---

## Connects To

```
LPS v0.1              — dominant long-term signed-manifest system; not replaced
PROPOSAL 005 (A.8R)   — complementary LPS redundancy research; not C2PA Text A.9
PROPOSAL 006          — optional, registry-dependent hash-carrier direction; not a replacement
C2PA Text A.8         — LPS v0.1 carrier basis; A.8/A.8R retain a Unicode-conformance concern
EU AI Act Art. 50     — [LAW / COMPLIANCE] external adoption context; not carrier certification
Validation research   — [PENDING CROSS-CHECK] external transport and renderer dependencies
```

---
```
