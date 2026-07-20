## PROPOSAL 007 — Cooperative Span Marker System

---

```
PROPOSAL 007 — Cooperative Span Marker System
Status: Under Review — Pre-Submission Draft
Date: 2026-07-20
Author: Act-quiere / Systemactic
Relates to: LPS v0.1, PROPOSAL 005 (A.8R), C2PA Text specification
Does not replace: A.8 carrier, LPS v0.1 manifest pipeline
License: CC BY 4.0 (this document)
```

---

## Problem

AI-generated text is the least watermarked content format on the internet despite being the most consequential one to track.

Image, audio, and video provenance have working technical standards and deployed implementations. Text has none at scale. The C2PA Text specification defines carrier methods for embedding provenance signals in plain text. LPS v0.1 implements a cryptographically signed, segment-level manifest using the A.8 carrier. Both are sound systems. Neither is deployed at the generation layer by any major AI provider today.

The gap is not narrowing. Research published in peer-reviewed literature confirms that approximately 50% of newly published web articles and 57% of translated or machine-processed text online are currently AI-generated. These figures are increasing. The consequence is a self-consuming loop: models trained on web data are increasingly trained on outputs from prior model generations. Shumailov et al. (2024, Nature) confirmed measurable model degradation under this condition. The technical term is model collapse. The practical consequence is a gradual decline in output quality and factual grounding across successive model generations as AI-generated content displaces human-generated content in training corpora.

No crawler, no training data pipeline, and no compliance auditor currently has a reliable in-band signal to distinguish AI-generated text spans from human-generated text spans in general web content. Scraping pipelines run without provenance guidance. Training data curation operates without span-level AI attribution. The gap between what regulation requires and what technical tooling provides is real, documented, and expanding.

The EU AI Act Article 50 requires disclosure of AI-generated content. The enforcement deadline is August 2, 2026. AI providers need a technical mechanism to satisfy this requirement. No cross-provider standard for text span marking currently exists.

---

## What This Proposal Is Not

This proposal does not replace LPS v0.1. It does not replace the A.8 carrier or the cryptographic manifest pipeline. It does not provide forensic-grade verification. It does not eliminate the possibility of adversarial removal. It does not require a registry. It does not require cross-provider infrastructure.

This proposal is a cooperative signaling layer — a low-cost, low-overhead mechanism that marks AI-generated and human-generated text spans at generation time using invisible Unicode characters. Its value is proportional to adoption. Its cost is proportional to almost nothing.

---

## What This Proposal Does

At generation time, an AI tool wraps each span of its output with a pair of invisible Unicode characters: one before the first character of the span, one after the last. Human-authored spans receive a different pair. The characters are invisible — they produce no visible glyph, occupy no screen space, and cause no layout change in any browser or text editor tested.

A crawler, a training data filter, or a compliance auditor reading the text finds these markers and can:

- Identify which spans were claimed as AI-generated at generation time
- Identify which spans were claimed as human-authored
- Calculate an approximate AI/human proportion from pair counts or character-weighted span lengths
- Detect reordering, gap sequences, or orphaned markers as signals of post-generation modification

No registry query is required. No network request is required. No cryptographic key is required. The signal is in the text.

---

## Marker Design

### Codepoint Selection

The candidate markers are drawn from the Unicode Invisible Operator range: U+2060 through U+2064. These codepoints are defined in the Unicode standard for use as invisible mathematical operators. They carry no visible glyph in any tested rendering environment. They are valid UTF-8. They do not trigger replacement character rendering (U+FFFD) in VS Code, Chrome, Safari, Firefox, or any editor in the LPS survival test matrix.

They are distinct from the variation selector range (U+FE00–U+FE0F, U+E0100–U+E01EF) used by the A.8 carrier. PROPOSAL 007 markers and A.8 manifests can coexist in the same document without collision.

### Compound Marker Sequences

A single codepoint marker is vulnerable to accidental collision with legitimate mathematical content that uses these characters individually. A compound 3-codepoint sequence reduces collision probability to near zero in non-mathematical prose contexts and makes the marker structurally distinguishable from any incidental occurrence.

**Candidate compound marker set — not yet locked, requires working group input:**

```
AI span open:    U+2061 U+2062 U+2063   (9 bytes UTF-8)
AI span close:   U+2063 U+2062 U+2061   (9 bytes UTF-8, reversed)
Human span open: U+2061 U+2064 U+2063   (9 bytes UTF-8)
Human span close:U+2063 U+2064 U+2061   (9 bytes UTF-8, reversed)
```

The middle codepoint is the type identifier: U+2062 marks an AI span, U+2064 marks a human span. The outer pair `U+2061 ... U+2063` is the structural wrapper shared by all markers. Direction — forward or reversed — distinguishes open from close. A verifier needs no lookup table. It reads the sequence and derives type and direction from position.

### Byte Cost

Each compound marker is 9 bytes (3 codepoints × 3 bytes UTF-8 each). A pair — open plus close — is 18 bytes. A document with 10 AI spans and 3 human spans carries 234 bytes of marker payload. A document with 50 spans carries under 1,000 bytes. This is negligible relative to typical document size and produces no perceptible latency.

### Ordinal Sequencing

Each marker pair carries a sequence number to survive document reordering. If a user moves paragraphs, the ordinal survives attached to its span. A verifier reading markers out of document order reconstructs the original sequence from ordinals, detects gaps where pairs were deleted, and flags orphaned markers where reordering broke a pair without removing both.

The ordinal is encoded as a single additional invisible codepoint appended to the compound marker. One byte of ordinal supports up to 255 pairs per document. Documents requiring more than 255 pairs use a two-codepoint ordinal. The encoding for the ordinal codepoint is defined separately in the marker specification and is not part of the candidate set above.

---

## Implementation Mechanism

### No External Library Required

The A.8 carrier requires the `c2pa-text` library because it encodes an arbitrary binary payload — a 700-to-2000-byte CBOR manifest — into a sequence of Unicode variation selector codepoints. Encoding arbitrary binary into valid Unicode requires an encoding layer. That is what the library provides.

PROPOSAL 007 carries no binary payload. Each marker is a fixed sequence of defined Unicode codepoints. No encoding is required. The entire implementation in any language is one function call:

**JavaScript:**
```javascript
const AI_OPEN  = String.fromCodePoint(0x2061, 0x2062, 0x2063);
const AI_CLOSE = String.fromCodePoint(0x2063, 0x2062, 0x2061);
const HM_OPEN  = String.fromCodePoint(0x2061, 0x2064, 0x2063);
const HM_CLOSE = String.fromCodePoint(0x2063, 0x2064, 0x2061);

function markAISpan(text)    { return AI_OPEN  + text + AI_CLOSE;  }
function markHumanSpan(text) { return HM_OPEN  + text + HM_CLOSE;  }
```

`String.fromCodePoint` is a native JavaScript built-in present in every modern browser and every Node.js version. No dependency. No installation. No network request. No library version to manage.

The same operation is one line in Python (`chr(0x2061) + chr(0x2062) + chr(0x2063)`), Go, Rust, or any language with Unicode string support. The implementation cost for any AI provider is measured in hours, not sprints.

### What AI Providers Must Change

The change required at the provider level is confined to the output post-processing pipeline. After a model generates a response, before the response is returned to the caller, the post-processing layer:

1. Identifies span boundaries — for fully AI-generated responses, the entire response is one AI span. For mixed human/AI documents, the model tracks which tokens in context were human-authored and which it generated.
2. Wraps each span with the appropriate compound marker using the mechanism above.
3. Returns the marked response.

This does not require retraining the model. It does not require changes to the model weights. It does not require changes to the tokenizer. It is a post-processing step in the serving infrastructure — the same layer that handles rate limiting, content filtering, and response formatting. The engineering cost is low. The operational cost per response is three string concatenation operations.

### Arbitrary Position Placement

The A.8 library appends its wrapper after the last visible character. PROPOSAL 007 markers must appear at span boundaries within the text, not appended at the end. The placement mechanism for mid-document spans is string splitting:

```javascript
function insertMarkerAt(text, offset, marker) {
  return text.slice(0, offset) + marker + text.slice(offset);
}
```

This is standard string manipulation. No library. No bypass required. The split-and-rejoin pattern works identically in every language. For the A.8R carrier defined in PROPOSAL 005, this same pattern enables arbitrary position placement of A.8 wrappers — described in PROPOSAL 005 as HOLD-2. PROPOSAL 007 uses the same pattern independently, without the A.8 library.

---

## Verification

### What a Verifier Does

A verifier reading a document containing PROPOSAL 007 markers:

1. Iterates codepoints in the string using a codepoint-safe loop (not byte iteration, not `charAt`)
2. Identifies compound marker sequences by matching the 3-codepoint pattern
3. Groups identified markers into pairs by type (AI or human) and ordinal
4. Calculates span character counts between matched open and close markers
5. Computes weighted AI/human proportion from span character counts
6. Reports: span count by type, character-weighted proportion, sequence integrity (gaps, orphans, inversions detected)

### What the Output States

The verifier does not state "AI-generated." It states:

- AI-marked spans found: N
- Human-marked spans found: M
- Estimated AI proportion by character weight: X%
- Estimated human proportion by character weight: Y%
- Signal integrity: intact / orphaned markers present / sequence gaps detected / inverted pairs detected

The qualifier language is intentional. The system is cooperative — markers can be added or removed by any actor with Unicode text editing capability. The output reflects what the signal says, not what the content provably is. A document with stripped markers and no surviving signal is reported as: no provenance signal present. A document with damaged or inconsistent markers reports the damage degree.

### Damage Degree Reporting

A partially surviving signal is more informative than no signal. If 8 of 10 AI span pairs survive and 2 are missing, the verifier reports:

- Pairs found: 8 of expected 10 (gap at ordinals 4 and 7)
- Signal completeness: 80%
- Estimated proportion from surviving pairs: [calculated from surviving spans]
- Note: gaps in ordinal sequence indicate post-generation modification or partial copy

A document with no surviving markers and no LPS v0.1 manifest is not evidence of human authorship. It is evidence of an absent signal. The distinction matters forensically.

---

## Survival Characteristics

### Confirmed Surviving Environments (single codepoint testing — compound sequence testing pending)

- VS Code: no tofu, no replacement character, no layout artifact
- Chrome, Safari, Firefox: renders invisibly, copies correctly via Command+C and right-click copy
- HTML `<p>` elements: no layout effect, no CSS rendering change
- JavaScript `textContent` assignment: codepoint present in DOM, clipboard-accessible
- HTML entity injection (`&#x2061;`): parsed correctly by browser HTML parser, codepoint in DOM
- JavaScript `insertAdjacentText()`: post-render DOM insertion, codepoint in DOM and clipboard

### Known Stripping Environments

- HTML sanitizers (DOMPurify, sanitize-html, Bleach) in aggressive configuration: U+200B–U+200D stripped; U+2061–U+2064 not in documented strip lists as of testing date
- WhatsApp send path: confirmed stripping of A.8 variation selectors; behavior for U+2061–U+2064 not yet tested
- Windows Word desktop, mobile Safari, Android Chrome: not yet tested — see VALIDATION-1

### Stripping and Adversarial Removal

A technically sophisticated actor can strip compound markers with a targeted regular expression. This is acknowledged and accepted. The system is not designed to be cryptographically unstrippable — that is the role of LPS v0.1. The system is designed to raise the cost of removal above zero and to make removal itself a forensically meaningful signal.

Stripping a signal is not the same as never having had one. A document that previously carried markers and had them removed leaves traces in version history, transmission logs, and diff records. Intentional removal is harder to explain than the absence of a signal that was never produced. At the population scale of AI-generated web content, the aggregate cost of stripping markers across millions of documents creates a meaningful deterrent for non-targeted mass removal.

Most content consumers — including the automated crawlers and training data pipelines that represent the primary audience for this signal — do not strip Unicode characters. They pass them through. The signal reaches its intended audience without requiring the cooperation of any adversarial actor.

---

## Relationship to LPS v0.1

PROPOSAL 007 and LPS v0.1 are complementary systems operating at different trust tiers.

LPS v0.1 provides forensic-grade provenance: a cryptographically signed manifest with segment-level attribution, confidence scoring, certificate-backed verification, and tamper detection. It is the right tool for legal proceedings, regulated industries, and high-stakes content verification.

PROPOSAL 007 provides cooperative provenance: a lightweight span marker that survives copy-paste in most environments, requires no registry, costs nothing to verify, and can be implemented by any AI provider in hours. It is the right tool for training data filtering, compliance disclosure, and model collapse mitigation at web scale.

A document can carry both simultaneously. The A.8 manifest and the PROPOSAL 007 markers use different Unicode ranges and do not interfere. A verifier can check for both independently. The presence of both signals strengthens provenance. The presence of one without the other is still informative.

The intended adoption sequence: PROPOSAL 007 is deployable now, under existing regulatory pressure, at near-zero infrastructure cost. LPS v0.1 is the long-term standard — more capable, more verifiable, more complete — targeting working group standardization and coordinated provider adoption. PROPOSAL 007 contributes to closing the gap while that process runs. It is not a replacement. It is a starting point.

---

## Regulatory and Economic Framing

### The Cost Argument

AI providers currently face a choice between three outcomes: build a watermarking mechanism, pay regulatory fines, or face litigation. The EU AI Act Article 50 fines for non-compliance reach up to 3% of global annual turnover. For a major AI provider, that figure exceeds the engineering cost of implementing PROPOSAL 007 by several orders of magnitude.

A hash-registry architecture — an alternative approach under consideration by several parties — requires compute to hash every output, network infrastructure to write to a distributed registry, storage for registry entries, and compute to serve lookups. Infrastructure estimates for a major provider at production scale exceed $100,000 per month. PROPOSAL 007 requires three string concatenation operations per response. The cost comparison is not marginal. It is categorical.

The argument is not that providers should adopt PROPOSAL 007 because it is cheap. The argument is that providers will spend money either way — on implementation, on fines, or on litigation. The question is which expenditure produces a functional system. PROPOSAL 007 produces a functional system. Fines and litigation produce nothing.

### The Collaborative Path

PROPOSAL 007 does not require all providers to agree simultaneously. Any provider that implements generation-time span marking immediately produces marked output. Crawlers and training data pipelines that check for markers immediately benefit from that provider's marked output. Adoption by one large provider creates pressure for others to follow — not through coordination, but through the practical reality that a training corpus with partial provenance signals is more useful than one with none.

The working group submission is the mechanism for turning individual adoption into an interoperable standard. The compound marker set proposed above is a candidate — the specific codepoints, sequences, and ordinal encoding are working group decisions, not unilateral ones.

---

## Open Questions — Requires Working Group Input

- **Codepoint set lock.** The candidate compound marker set must be confirmed or replaced. Working group input required on whether U+2061–U+2064 is appropriate or whether the Unicode Private Use Area is preferable to eliminate collision risk with legitimate mathematical content entirely.

- **Ordinal encoding.** The single-codepoint ordinal scheme supports 255 pairs. Whether this is sufficient for production documents, and which codepoint range is used for ordinal values, requires working group input.

- **Mathematical content disambiguation.** Documents mixing AI-generated prose with inline mathematical notation risk false positives if the same codepoints appear in both contexts. A disambiguation mechanism — such as a document-level declaration of PROPOSAL 007 usage — may be required. No resolution adopted.

- **LLM output collision rate.** Whether frontier model tokenizers spontaneously emit U+2061–U+2064 in non-mathematical output requires empirical testing at scale. This is a pre-adoption validation requirement, not a pre-submission blocker.

- **Stripping behavior across untested platforms.** WhatsApp, Windows Word, mobile Safari, and Android Chrome have not been tested with the candidate codepoints. Testing required before survival claims can be made for those environments. See VALIDATION-1.

- **Compound marker survival testing.** Single codepoint survival has been tested and confirmed in the LPS Proposal 007 survival matrix tool. Compound 3-codepoint sequence survival has not yet been tested. Testing required before the compound marker set is proposed to the working group.

---

## What Has Been Built

**`test-proposal-007-markers.html`** — A self-contained browser-based survival test matrix. 135 embedded text blocks across 5 codepoints, 3 fonts, 3 injection methods (JS `textContent`, HTML entity, JS `insertAdjacentText`), and 3 size tiers (18px, 15px, 12px). No external dependencies. Includes an embed and verify utility strip for manual round-trip testing. Copy performed via Command+C or right-click — no copy buttons on matrix blocks to ensure browser-native clipboard behavior is tested.

**Survival findings to date:**
- U+2060–U+2064 produce no tofu (U+FFFD) in VS Code
- U+2060–U+2064 produce no layout artifact in Chrome, Safari, Firefox HTML rendering
- JS `textContent` injection: codepoint present in DOM and clipboard-accessible
- HTML entity injection: correctly resolved by browser HTML parser
- JS `insertAdjacentText` injection: post-render DOM insertion confirmed functional
- Full compound sequence survival: pending

---

## Implementation Status

```
Marker design:          Candidate defined — not locked
Codepoint selection:    Candidate defined — requires working group input
Compound sequence:      Candidate defined — survival testing pending
Ordinal scheme:         Defined — encoding not locked
Verifier logic:         Defined — not built
Test tool:              Built — single codepoint matrix complete
Compound test:          Not yet built
Provider integration:   Not built — requires provider adoption
A.8R dependency:        Inherited from PROPOSAL 005 HOLD-2
```

---

## Connects To

```
LPS v0.1              — primary manifest system; parallel track, not replaced
PROPOSAL 005 (A.8R)   — arbitrary position placement pattern; shared mechanic
PROPOSAL 006          — hash-registry architecture; alternative approach, higher infrastructure cost
C2PA Text A.8         — existing carrier; PROPOSAL 007 uses different Unicode range, no conflict
EU AI Act Art. 50     — regulatory mandate driving adoption timeline
VALIDATION-1          — cross-platform survival testing; must include PROPOSAL 007 candidates
```

---
```