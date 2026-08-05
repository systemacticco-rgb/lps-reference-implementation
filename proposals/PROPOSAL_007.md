## PROPOSAL 007 — Cooperative Span Marker System

---

```
PROPOSAL 007 — Cooperative Span Marker System
Status: [PROPOSED] — under architectural definition
Date: 2026-07-20
Revision: V1 — ADR evidence alignment, 2026-07-29
Session-log alignment: standards-boundary remediation, 2026-07-29
Author: Systemactic
Relates to: LPS v0.1, deferred PROPOSAL 005 (A.8R), C2PA Text discussion
Does not replace: LPS selector carrier, LPS v0.1 manifest pipeline
License: CC BY 4.0 (this document)
```

---

## Problem

Machine-readable text signals may enable participating crawlers and training pipelines to identify, exclude, downweight, or separately handle marked content. They may support data-curation strategies that separately treat model output; they do not establish a causal effect on model collapse or prevent it.

Article 50 is an external adoption and compliance context for evaluating interoperable machine-readable marking. It does not validate or certify this carrier, and the Code of Practice is voluntary. Provider adoption, regulator interpretation, and the applicable disclosure obligation remain external dependencies.

---

## What This Proposal Is Not

This proposal does not replace LPS v0.1, the LPS selector carrier, or the cryptographic manifest pipeline. It is not a deployed or forensic-grade system. It does not provide cryptographic integrity, issuer authentication, provider authentication, or proof of AI origin. It does not eliminate adversarial removal or forgery.

This proposal is a cooperative invisible-Unicode signalling layer for claimed text-span classification. Its value depends on provider adoption and on the preservation and interpretation decisions of transport, renderer, crawler, and training-pipeline operators.

---

## What This Proposal Does

 The AI-only model is operative. Human span markers, per-span ordinal fields, and per-span total-count fields are removed. The document-level header carries the total AI-span count. Ordinal-level gap localization is not available under the header-only model.

[SECURITY / LIMITATION] A scanner that recognises a complete published grammar can classify text as carrying a claimed cooperative signal. Invisible Unicode alone establishes neither AI origin nor malicious intent; a recognised grammar cannot authenticate an issuer, provider, or author.

[LIMITATION] No registry or cryptographic key is part of PROPOSAL 007. A missing marker establishes neither stripping, intent, nor human authorship. Registry recovery in the LPS portfolio is separately limited to an exact visible-text hash with an existing generation-time record; it cannot restore missing span-level evidence.

---

## Marker Design

### Codepoint Selection

The approved codepoint library is U+2060–U+2064: U+2060 is the structural identifier; U+2061 is the AI span type identifier; U+2062 and U+2063 are open and close directions; U+2064 is the header type discriminator and base-5 digit value 4. No codepoint outside this library is valid at a Proposal 007 grammar position. Invalid occurrences of U+2060–U+2064 are discarded and do not contribute to a calculation. The tag block U+E0000–U+E007F, U+200B–U+200D, U+2065–U+206F, BMP PUA, variation-selector supplement, and directional controls are excluded.

Renderer, IDE, sanitizer, browser, and transport behaviour for the approved library remains unconfirmed beyond the scoped test tool. Coexistence with an LPS selector payload is a candidate design assumption, not an interoperability or survival claim.

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

### Optional Variants

he following are documentation-only fallbacks. No variant is promoted by the current findings.

#### Variant 007-A — AI spans only

Documentation-only fallback. The operative grammar is AI-only and does not treat unmarked text as human-authored.

#### Variant 007-B — One-codepoint span markers

Documentation-only fallback. No one-codepoint marker is selected for the operative grammar.

A provider-adopted one-codepoint variant would still be forgeable; malicious actors could inject codepoints inside otherwise valid spans.

#### Variant 007-C — Header total-count markers

Documentation-only fallback. The operative grammar includes a document-level header carrying the total AI-span count.

---

## Implementation Mechanism

### Reference and Provider Scope

PROPOSAL 007 is not deployed. Provider-facing marking depends on provider cooperation. If an AI provider's output contains no header, the LLM must place the document-level header at the beginning of the generated text. No provider-integration cost, deployment schedule, or cross-provider interoperability is established.

JavaScript/Node.js remains a reference implementation environment. Runtime throughput, typed integration contracts, binary hash representation, CPU concurrency, and cross-language transport are production dependencies; they do not block discussion-draft review, but they do block production-deployment or commercial-SLA claims.

An LLM/provider, model, deployment, or issuer identifier prefix is not part of Proposal 007. No identifier grammar, registry, or implementation is authorized pending working-group review and feedback.

### What AI Providers Should Change

Providers must use the defined AI span grammar and document-level header. Provider cooperation is an external dependency, not a property that this proposal can enforce.

### Arbitrary Position Placement

Markers, if adopted, would need placement at defined span boundaries. The PROPOSAL 005/A.8R arbitrary-position concept is separate research for LPS v0.1. No Proposal 005 implementation or pre-submission revision is authorized before working-group feedback; it is not an independent system or C2PA Text A.9.

---

## Verification

### What a Verifier Does

The verifier normalizes the input before scanning: it strips a leading U+FEFF at position 0 and trailing U+0020, U+000A, and U+000D codepoints, logging their hex values and count. It scans the approved library, records the first valid document header, and matches valid AI open and close markers in document order. E001–E011 are the complete verifier output.

### Verification Semantics

| Condition | Required verifier result |
|---|---|
| Valid header and valid AI pairs survive | Report surviving pairs, header total, and survival rate = pairs ÷ header total. |
| Valid header survives and zero AI pairs survive | Report the header total as a generation-time signal; state that the header is present and no span signal survives. Do not infer stripping. |
| No valid header and valid AI pairs survive | Report surviving pairs; state that the generation-time total is unknown and survival rate is not computable. |
| No valid header and no valid AI pairs survive | Return `NO_VALID_MARKDOWN_FOUND`. Do not infer stripping or provenance. |
| Standalone U+2060 fails the position-1 type check | Discard it without reporting or including it in a calculation. |

### What the Output States

A verifier may report a recognized grammar as a claimed cooperative signal. It cannot report cryptographic provenance, issuer identity, provider identity, authorship, or AI origin. Markers are removable and forgeable.

A document with no surviving markers has an absent signal; that absence does not establish stripping, intent, or human authorship.

### Damage Degree Reporting

**Excess opens and closes are orphaned markers (E007 and E008) and are not counted as valid pairs. Internal approved-library codepoints at non-marker positions within a valid pair trigger INTERNAL_SIGNAL (E009); the pair remains valid and counted. Surviving valid pairs exceeding the header total trigger IMPOSSIBLE_COUNT (E010); the pairs are not suppressed.**
---

## Survival Characteristics

### Scoped Test State

The browser matrix is a 18-card render test. Layout survival at 12px and 15px is confirmed clean; those cards are removed for test efficiency. Nine 18px bidi cards—three Arabic, three Hebrew, and three Persian—are added. The tool is a render test with an attached embed–copy–verify utility. The observations below are scoped browser testing-tool observations only; the tool is not a validated round-trip test. T.Clipboard instrumentation must confirm post-clipboard codepoint-array integrity and embedding-dropdown decoupling must be implemented.

This tool does not establish injection, platform-survival, or interoperability claims. The recorded messenger, social, AI, editor, mobile-browser, and Universal Clipboard routes below are evidence for their exercised paths only. Other browsers or renderers; untested routes on named services; external APIs and LLM transports; Windows or Linux; sanitizers, crawlers, IDEs, accessibility tooling, and external transports remain pending cross-check. Compound three-codepoint round trips outside the scoped observations, pasted-codepoint instrumentation, and any unrecorded route remain to be tested.

### Scoped Browser Testing-Tool Observations

For the first retained U+2060 row, ordinary double-click selection and copy through JavaScript `textContent`, HTML entity, and JavaScript `insertAdjacentText` injection paths preserved one valid document-level header and one valid AI pair across Georgia, System UI, and Menlo. The verifier reported `100.0% (1 / 1)`. In this observed browser test, the pasted value contained two trailing U+000A codepoints. Under the defined trailing-normalization rule, the verifier normalizes those trailing U+000A codepoints and the valid document-level header and AI pair survive. This confirms scoped browser-selection/copy behavior only; it does not establish a universal browser clipboard or transport rule.

 Endpoint-sensitive drag selection produced different pasted codepoint sequences: a complete document-level header and AI pair, header-only input, orphaned open or close markers, or no valid document-level header or AI pair. Corresponding verifier results, including E007, E008, and E011, reflect the pasted codepoint sequence. They are not evidence of stripping, provenance, AI origin, or application mutation. Command-modified drag selection was inconsistent: both full survival and partial or no-valid-signal outcomes were observed. This is a scoped selection-behavior observation, not a deterministic font or injection defect.

| Injection path | Scoped observed selection outcome |
|---|---|
| JavaScript `textContent` | Complete selections survived; modified drag selections could yield orphaned-close/no-valid-signal results. |
| HTML entity | Selection endpoint and drag direction could produce full survival, header-only/orphaned-open results, or no valid signal. |
| JavaScript `insertAdjacentText` | Selection endpoint and drag direction could produce full survival, header-only/orphaned-open results, orphaned-close/no-valid-signal results, or no valid signal. |

No injection path is generally safer than another on this evidence; the observed outcome depends on the selected range.

### Recorded Cross-Transport Evidence — ADR 2026-07-29

An ADR records observations made with the Proposal 007 tool across named applications, devices, selection actions, copy operations, sends or posts, and verifier inputs. A result of 100% survival means that the verifier found valid Proposal 007 signals for the recorded route. It is not a statement about a service in general, clipboard interoperability, provenance, authorship, stripping, or mutation.

#### Messenger routes

| Service | Recorded result | Exercised route and boundary |
|---|---:|---|
| Facebook Messenger | 100% survival | Desktop send, logout/login, mobile copy, resend, copy into the verifier, and validation completed with valid signals. The observed double-click selection appended a trailing U+0020; selection and copy precision changed the received input. iPhone-to-macOS Universal Clipboard also succeeded. |
| Telegram | 100% survival | Desktop send, mobile copy, resend, and verifier validation retained valid signals. Double-click selection or an exact highlight was needed for reliable capture. iPhone-to-macOS Universal Clipboard succeeded. |
| WhatsApp | 100% survival | Desktop send, mobile copy, resend, and verifier validation retained valid signals. Reliable capture required double-click selection or a precise highlight. iPhone-to-macOS Universal Clipboard succeeded. |

These messenger results are strong observations of the listed routes. A different route with no valid signal would describe its received codepoints; it would not identify a service-side cause.

#### Social, AI, editor, and mobile routes

| Target | Recorded result | Exercised route and boundary |
|---|---:|---|
| Universal Clipboard, iPhone to macOS | 100% survival | A payload moved from the Claude mobile app to macOS without a manual conversion step and validated in the tool. |
| Facebook Web, macOS | No post survival recorded | The composer retained signals, but the observed post path did not. This is an end-result observation and does not assign a mechanism or actor. A historical longer signed LPS-manifest route is a different carrier and does not make this marker route comparatively safe or unsafe. |
| Instagram Web, macOS | 100% survival | The composer and post path retained valid signals; iPhone-to-macOS Universal Clipboard was also observed. |
| ChatGPT Web and desktop app, macOS | 100% survival | Sent messages still held valid signals when checked after several days; iPhone-to-macOS Universal Clipboard was observed. |
| Claude Web and desktop app, macOS | 100% survival | Sent messages still held valid signals when checked after several days; iPhone-to-macOS Universal Clipboard was observed. |
| Gemini Web, macOS | 100% survival | Sent messages retained valid signals. |
| X | 100% survival | A posted route retained valid signals. This observation does not extend to video or photo editors. |
| Photoshop | 100% survival | No signal loss was observed. It does not establish behavior for photo or video editors generally. |
| Android and iOS browser/tool use | 100% survival | The test tool opened directly on both platforms and validated. |
| Reddit, macOS browser | 100% survival | A posted route retained valid signals. |
| Notion desktop app, macOS | 100% survival | Copy and paste retained valid signals. |
| Slack desktop app, macOS | 100% survival | Copy, paste, and send retained valid signals. |

No visual glyphs were observed on the stated routes where that observation was recorded. This is only a rendering observation; it does not establish accessibility, font, renderer, or cross-platform behavior.

### Selection and Evaluation Boundary

Selection is part of the received-input contract. Double-click and precise highlighting can yield different codepoint sequences; the Facebook Messenger run added a trailing U+0020 after double-click selection, while Telegram and WhatsApp required double-clicking or precise highlighting for reliable capture. These observations do not identify a deterministic fault in a service, font, injection path, or operating system.

[SECURITY / LIMITATION] Where the verifier finds valid signals, it reports the exercised payload and route only. Where it finds no valid signal, including NO_VALID_MARKDOWN_FOUND where applicable, it reports the received input only. Neither outcome establishes stripping, provenance, AI origin, authorship, or the reason a signal is absent.

### Scoped Pathological-Input Observations

 The testing tool's pathological generator exercised controlled verifier inputs with supplied `header total 1 / AI spans 1`:

| Mode | Observed result |
|---|---|
| Malformed sequence | E001 `TRUNCATED_MARKER` |
| Reordered fields | E002 `INVALID_TYPE` |
| Duplicate header | E006 `DUPLICATE_HEADER`; the first valid document-level header remains authoritative |
| Orphaned open | E007 `ORPHANED_OPEN` |
| Orphaned close | E008 `ORPHANED_CLOSE` |
| Trailing normalization | Valid document-level header and AI pair survive after normalization |
| Internal codepoints | E009 `INTERNAL_SIGNAL`; the valid AI pair remains counted |

The pathological generator creates controlled verifier inputs only; it is not a production embedding path.

### Scoped Re-embedding Limitation

In the testing tool, re-embedding text that already contains PROPOSAL 007 signals does not remove the prior signals. Repeated embedding can therefore create compound input and verifier errors. A production policy for pre-embedded input remains undefined and requires separate design work. This does not infer how an LLM, provider, or external system must treat pre-embedded input.

### Retained Bidi Cross-Check Findings

Arabic, Hebrew, and Persian cards use the existing Georgia, System UI, and Menlo assignments. The PROPOSAL 007 marker grammar uses U+2060–U+2064; it does not use LRM, RLM, bidi embeddings, overrides, or isolates. RTL visual-selection behavior and copied-range boundaries remain browser-rendering/selection concerns, not evidence that language content strips markers. The observed trailing U+000A values are not application-generated marker content; verifier normalization handles them as trailing transport/clipboard whitespace. The row labelled U+2060 contains a complete document-level header and a full AI open/close pair; it is not an isolated-U+2060 survival test. Bidi transport, renderer, accessibility, and cross-platform questions remain pending cross-check.

### Known Stripping and Rendering Limits

Session research identifies U+2060–U+2064 as targeted by at least one LLM-gateway stripping rule; source citation remains pending. Transport, sanitizer, scraper, mobile, and application-specific stripping behaviour is not a final claim.

### Stripping and Adversarial Removal

 PROPOSAL 007 markers are removable and forgeable. A recipient may preserve them, remove them manually, use automated stripping, or treat them as a disclosure signal. A smaller carrier’s survival, removability, and forensic assurance are separate measurements; no removal deterrence or forensic conclusion follows from this proposal.

**The frequency and cost of preservation or removal choices, including crawler and training-pipeline treatment, require behavioral and transport research.**
---

## Relationship to LPS v0.1

LPS v0.1 remains the dominant long-term signed-manifest system and the only portfolio layer making a cryptographic-integrity claim. PROPOSAL 007 is a complementary, lowest-assurance cooperative marker mechanism; it does not replace LPS v0.1.

C2PA Appendix A.8 describes a wrapper with a U+FEFF prefix, a contiguous variation-selector block, and a C2PA Manifest Store in JUMBF format. The documented LPS v0.1 selector carrier signs an LPS JSON manifest with native cryptography; it does not emit that C2PA Manifest Store or a C2PA COSE_Sign1_Tagged claim signature. Therefore it is not described as a C2PA A.8 implementation or C2PA-compatible workflow.

C2PA describes its selected variation selectors as valid Unicode and visually non-rendering. This proposal does not assert a generic proven Unicode non-conformance without an identified violated Unicode or C2PA rule. Empirical questions about rendering, clipboard behavior, sanitization, and transport survival remain separate pending cross-checks.

The primary LPS selector-carrier submission direction is closed internally. That decision neither changes Proposal 007's
scope nor establishes C2PA A.8 conformance.

LPS registry recovery can corroborate only an exact visible-text hash with an existing generation-time record. It does not restore missing span-level evidence. PROPOSAL 007 has neither a registry-recovery path nor a signature.

**A document may be designed to carry both the LPS selector payload and PROPOSAL 007 markers, but transport preservation, renderer behavior, coexistence, and verifier interpretation remain external dependencies rather than established outcomes.
---**

## Regulatory and Economic Framing

Cost, market, penalty, adoption, and registry-operating figures require primary citations before being used as confirmed framing. No implementation-cost or deployment benefit is established here.

### The Collaborative Path

Provider adoption and crawler or training-pipeline interpretation are cooperative external dependencies. The grammar defines conforming behavior; it does not enforce conformance.

---

## Open Questions — Requires Working Group Input

- **Header scope beyond a document.** A document-level header cannot distinguish independently generated sections in a multi-section web page. Per-paragraph header scoping remains open.

- **Lens 200 boundary.** Embedding positions for inputs longer than 200 visible characters are undefined. This is a testing-tool concern only.

- **Collision and security handling.** Mathematical-content collisions, LLM spontaneous-output collision rates, and scanner, sanitizer, or scraper handling require reproducible testing and source discipline.

- **Signal interpretation.** The completed grammar must retain the boundary that it supports recognition of a claimed cooperative signal, not authentication of AI origin, issuer, provider, or author.

- **Standards language.** Proposal 007 must remain separate from the LPS selector-carrier conformance sweep. No C2PA, COSE, JOSE, certificate, or validation claim may be expanded beyond independently recorded evidence.

- **Portfolio dependencies.** Proposal 005 is deferred pending working-group feedback. Proposal 006 remains under review and has no active pre-submission revision or implementation work.

---

## What Has Been Built

`test/test-proposal-007-markers.html` is a browser render test with an attached embed–copy–verify utility. It is not a validated round-trip test until T.Clipboard instrumentation confirms post-clipboard codepoint-array integrity and embedding-dropdown decoupling is implemented.

The tool recorded the browser selection/copy observations and the ADR's named route-specific cross-transport results. Neither set establishes a general clipboard, transport, or injection-path result.

Compound-sequence survival outside those scoped browser observations and all cross-platform transit results remain open.

---

## Implementation Status

```
Marker design:          AI-only grammar defined
Codepoint selection:    Approved library U+2060–U+2064
Compound sequence:      Defined AI open and close markers
Human-span policy:      Human markers removed from main grammar
Ordinal/header scheme:  Document-level header; no per-span ordinal or total count
Verifier logic:         Deterministic header and pair verification defined
Test tool:              Render test with attached embed–copy–verify utility
Browser selection/copy: Selection-range-dependent browser-tool evidence only
Provider integration:   Requires external provider cooperation
Runtime status:         JavaScript reference only
A.8R relationship:      No build before working-group feedback; not C2PA Text A.9
```

---

## Connects To

```
LPS v0.1              — dominant long-term signed-manifest system; not replaced
PROPOSAL 005 (A.8R)   — deferred redundancy research; no implementation before feedback
PROPOSAL 006          — proposal under review; revisit after submission
C2PA Text A.8         — standards context only; current LPS carrier makes no A.8 implementation claim
EU AI Act Art. 50     — [LAW / COMPLIANCE] external adoption context; not carrier certification
Validation research   — [PENDING CROSS-CHECK] external transport and renderer dependencies
```

---
```
