## PROPOSAL 001 — Server-Side Notarization Registry
Date: June 2026
Status: ASSESSED — deferred to post-v0.1

═══════════════════════════════════════════
PLAIN TERMS
═══════════════════════════════════════════

Every AI-generated output gets a hash plus timestamp written
to a server-side append-only log at generation time. The
content itself is not stored — only the fingerprint. A
presented document can later be checked against this log
to confirm it existed, unchanged, at a specific moment.

The registry and the embedded LPS manifest have separate jobs.
The manifest describes what the content contains — who wrote
what, at what proportion, with what confidence. The registry
confirms the content existed at a specific moment unchanged.
Neither duplicates the other. Both are required for full
forensic coverage.

═══════════════════════════════════════════
WHAT GETS WRITTEN TO THE REGISTRY
═══════════════════════════════════════════

At generation time, two fields only:

content_hash — SHA-256 fingerprint of the generated content
              at the moment of creation. 64 hex characters.
              The same content always produces the same hash.
              Change one character and the hash is completely
              different.

created_at   — ISO 8601 timestamp of when the hash was written.
              Server-side timestamp — not client-supplied.
              Cannot be backdated by the requester.

Nothing else. The AI tool identifier, the account, the API key,
the LPS version — these are what the embedded manifest records.
The registry does not duplicate the manifest. The registry
confirms existence and time. The manifest describes content.

═══════════════════════════════════════════
THE TOKEN
═══════════════════════════════════════════

When the registry writes a record, it generates a token —
a unique identifier for that specific record. The token is
cryptographically random: 16 bytes from the operating system's
entropy source, encoded as hex, prefixed with lps_.

Example: lps_a7f3c9e2b4d1f8a3c6e9b2d5f0a3c7e1

16 bytes of entropy — 2^128 possible values. Cannot be guessed,
predicted, or brute-forced. The token is meaningless without
the registry backing it. An attacker can generate a string
that looks like a token. The registry returns no record for it.

The token is embedded in the document invisibly alongside the
LPS manifest — compressed and CBOR-encoded the same way.
If the manifest is stripped, the token may also be stripped.
The content hash fallback handles this case.

═══════════════════════════════════════════
HOW GENERATION WORKS — STEP BY STEP
═══════════════════════════════════════════

1. AI tool generates content
2. AI tool computes SHA-256 hash of the content
3. AI tool sends hash to the LPS registry API:
   POST /registry/record
   { content_hash: "e3b0c44298fc1c149afb..." }
4. Registry writes the record with a server-side timestamp
5. Registry generates a cryptographically random token
6. Registry returns the token to the AI tool:
   { token: "lps_a7f3c9e2b4d1f8a3c6e9b2d5f0a3c7e1" }
7. AI tool passes token to the LPS manifest generator
8. Token is embedded in the document alongside the manifest

This entire flow happens at generation time — before the
content is delivered to the user. The registry record exists
before the document leaves the AI tool.

═══════════════════════════════════════════
HOW VERIFICATION WORKS — STEP BY STEP
═══════════════════════════════════════════

Path A — Token available (embedded signal survived):
1. Verification tool extracts token from embedded signal
2. Verification tool queries registry:
   GET /registry/record?token=lps_a7f3c9e2...
3. Registry returns: content_hash, created_at
4. Verification tool hashes the received document
5. Verification tool compares computed hash against
   registry content_hash
6. If match: document is confirmed as existing at created_at
   unchanged
7. If no match: document was modified after registry record
   was written

Path B — Token absent (signal stripped, content hash fallback):
1. Verification tool hashes the received document
2. Verification tool queries registry:
   GET /registry/record?hash=e3b0c44298fc1c149afb...
3. Registry returns: token, created_at if record exists
4. If record found: document confirmed as existing at
   created_at unchanged — even without the embedded signal
5. If no record found: registry_required state — document
   has no registry record, origin unconfirmed

═══════════════════════════════════════════
ACCESS MODEL
═══════════════════════════════════════════

Tiered read access. The log is not public. Three tiers:

Tier 1 — Public verification endpoint.
Anyone can query by token or hash and receive a binary
confirmed / not confirmed response plus the timestamp.
No content is returned. No account required.

Tier 2 — Credentialed access.
Registered institutions — legal, journalistic, academic —
can access full record metadata including the AI tool
identifier if provided by the generating tool. Requires
registration and terms agreement.

Tier 3 — Legal authority access.
Court orders, regulatory requests. Full chain of custody
records. Access log of who queried the record and when.
This tier itself becomes forensic evidence.

═══════════════════════════════════════════
FORENSIC VALUE
═══════════════════════════════════════════

The registry recovers provenance in one specific case: when
the visible text is reproduced byte-for-byte and only the
embedded carrier was removed (the targeted-strip case). The
content hash is computed from the visible text at verification
time and matched for exact equality against the registry record.
Photographing, OCR, and retyping alter the visible bytes, which
changes the hash, which means the registry returns no match.
That lossy channel is not covered by the registry and is not
covered by LPS at all — it is the domain of statistical
watermarking in the SynthID class. The registry defends against
signal stripping, not against content reproduction.

This is not proof of authorship. It is corroborating
forensic evidence for legal proceedings — the same category
as a server access log or a certificate transparency entry.
Whether it is admissible depends on jurisdiction, judge,
and expert witness testimony.

Primary use case: court admissibility support.
Secondary use case: journalistic source verification.
Tertiary use case: regulatory compliance audit trail.

═══════════════════════════════════════════
WHY IT REQUIRES AI PROVIDER COOPERATION
═══════════════════════════════════════════

The hash must be written at generation time, server-side,
by the model provider. It cannot be retrofitted by a third
party after the content is delivered. The moment the content
leaves the AI tool without a registry record, the window
for creating an authentic record is closed permanently.

A third party receiving the content can create a hash and
submit it to a registry — but that record only proves the
third party had the content at that moment. It does not
prove when the AI generated it. The forensic value depends
entirely on the record being written at generation time by
the generating system.

Google, Anthropic, OpenAI, Meta must integrate this at
the generation layer. The LPS reference implementation
demonstrates the architecture. Adoption requires regulatory
mandate or voluntary commitment from providers.

═══════════════════════════════════════════
ANTI-FORENSIC PRINCIPLE — REGISTRY APPLICATION
═══════════════════════════════════════════

A document presented without an embedded LPS signal is
already suspicious — the absence of signal is evidence
of stripping. A document presented without a registry
record compounds that suspicion. A document presented
where the embedded token does not match any registry
record is the strongest forensic signal — someone created
a fake token or submitted content that was never registered.

The combination of stripped signal plus no registry record
plus a plausible-looking token that resolves to nothing
is itself a forensic pattern detectable and documentable
as evidence of intent to obscure origin.

═══════════════════════════════════════════
OPEN QUESTIONS FOR WORKING GROUP
═══════════════════════════════════════════

1. Registry hosting architecture
   Foundation-hosted neutral registry vs federated model
   with multiple compatible nodes. Federated requires
   a cross-registry query standard. Foundation-hosted
   requires governance and funding decisions.

2. What happens when content is legitimately republished
   The same content published by multiple parties should
   produce the same hash. The registry may have multiple
   records for the same hash — each from a different
   registering party at a different time. How the
   verification tool presents multiple records for the
   same content hash is an open design question.

3. Record retention policy
   How long does the registry retain records. Permanent
   retention raises privacy concerns — the hash of
   deleted content remains queryable. Time-limited
   retention reduces forensic value for old documents.

4. Token revocation
   If a content producer needs to revoke a registry record
   — content published in error, content under legal hold —
   what is the mechanism. Append-only logs cannot delete.
   A revocation record can be appended but the original
   record remains. How the verification tool handles
   revoked records is undefined.

5. Cross-registry legal access framework
   Defined in RESEARCH 002. The legal mechanism by which
   a court or regulator queries an AI company's registry
   does not exist yet. This question must be resolved
   before Tier 3 access has any practical meaning.

═══════════════════════════════════════════
v0.1 SCOPE
═══════════════════════════════════════════

Out of scope for reference implementation.
Supabase append-only table is technically buildable now.
Credentialed access layer requires institutional
relationships and legal framework design — not a code
problem at this stage.

registry_required state in verificationTool.mjs is
reserved and defined. It will trigger when the embedded
signal is absent. The registry query is not yet built.
When PROPOSAL 001 is implemented, the verification tool
queries the registry at this state and returns the result.

═══════════════════════════════════════════
CONNECTS TO
═══════════════════════════════════════════

PROPOSAL 002 — Token Binding. Token generation is a
function of the registry. PROPOSAL 002 defines how the
token travels with the document.
PROPOSAL 004 — AI Input Verification. Registry records
can confirm whether invisible data in a received document
corresponds to a legitimate LPS registration.
RESEARCH 002 — Cross-Registry Legal Access Framework.
SPEC.md section 6 — Server-Side Record Store.
Anti-forensic principle — registry absence is itself
forensic evidence.

*/==================================================================
==================================================================/*

## PROPOSAL 002 — Server-Side Token Binding for Text Provenance
Date: June 2026
Status: OPEN — architecture defined, not built

═══════════════════════════════════════════
ORIGIN
═══════════════════════════════════════════

Chilean public transit QR system. The system issues a QR code
as a fare token. Users attempted to bypass payment by
screenshotting the QR and reusing it. The system implemented
two countermeasures:

Countermeasure 1 — Screenshot blocking. The QR is rendered
in a hardware-backed protected display surface. Screenshot
returns a black screen. The QR never enters the capturable
display layer.

Countermeasure 2 — Server-side token binding. Even when the
screenshot bypass succeeded, the fare was still deducted.
The QR is not the fare. It is a pointer to a server-side
record bound to a specific user identity. When scanned —
regardless of how the visual was obtained — the server
finds the record, identifies the bound identity, and
charges the correct account. The visual representation
is irrelevant. The server-side binding is what matters.

Both countermeasures map directly to LPS. This proposal
defines how.

═══════════════════════════════════════════
THE CORE PROBLEM THIS PROPOSAL SOLVES
═══════════════════════════════════════════

The embedded LPS manifest survives copy-paste. It does not
survive screenshot. A user who wants to present AI-generated
content as human-written has one reliable bypass: screenshot
the text, use OCR — iPhone Live Text, Google Lens, any
equivalent — to convert the image back to plain text. The
output is clean text with zero invisible characters. Every
embedded signal is gone.

No cryptographic mechanism can prevent this at the content
level. The content is visible on screen. Any visible content
can be photographed. Any photograph of text can be converted
back to text by OCR. This is an architectural constraint, not
a solvable technical problem at the embedding layer.

PROPOSAL 002 addresses this through three independent layers
that together make the bypass detectable even when it succeeds.

═══════════════════════════════════════════
LAYER 1 — PLATFORM ENFORCEMENT
Screenshot blocking on native implementations
═══════════════════════════════════════════

On native mobile applications — iOS and Android — the AI
tool renders generated content in a hardware-backed protected
display surface. The operating system marks this surface as
non-capturable.

On iOS: UIScreen.isCaptured detection combined with rendering
sensitive content in a UITextField with isSecureTextEntry
or a protected UIView subclass. The screenshot compositor
cannot access the protected surface. Screenshot returns black.

On Android: FLAG_SECURE applied to the window containing
generated content. Android's screenshot system respects
this flag and excludes the protected window from capture.
Screenshot returns black for that portion of the screen.

The user cannot screenshot the generated text. The only way
to extract the text is through the app's own export mechanism.
That mechanism re-embeds the LPS signal on every copy or
export operation. The signal cannot be bypassed through
screenshot because screenshot returns nothing.

What this does not prevent:
A second physical device photographing the screen of the first.
This is unblockable at the software level. It raises friction
significantly — the attack requires physical access to a
second device and produces an image, not text, which requires
additional OCR processing. The casual bypass is closed.
The determined bypass still exists but is detectable through
the server-side layers below.

Applicability:
Native mobile apps only. Web browsers do not have access to
hardware-backed secure display surfaces. A website cannot
prevent a browser screenshot. Claude's web interface cannot
implement this protection. A native LPS-compliant app can.

═══════════════════════════════════════════
LAYER 2 — SERVER-SIDE TOKEN BINDING
The token that cannot be stripped
═══════════════════════════════════════════

At the moment AI content is generated and delivered, the
generating system registers the content with the LPS registry
and receives a token. That token is bound server-side to
three things:

content_hash    — SHA-256 fingerprint of the generated content
generating_id   — identifier of the AI tool and account that
                  produced the content
created_at      — server-side timestamp, not client-supplied

These three combined produce the token:

```javascript
import { createHash, randomBytes } from 'crypto';

// Token is cryptographically random — not derived from inputs
// The binding is stored server-side, not computable from the token
const token = 'lps_' + randomBytes(16).toString('hex');

// Registry record stores the binding
await registry.insert({
  token,
  content_hash: sha256(content),
  generating_id: aiToolIdentifier,
  created_at: new Date().toISOString()
});
```

The token is embedded in the document alongside the LPS
manifest — compressed and CBOR-encoded, invisible to the reader.

WHY THE TOKEN CANNOT BE STRIPPED EFFECTIVELY:

Stripping the embedded signal removes the token from the
document. But the server-side record exists permanently
and independently of what happens to the document. The
registry does not know or care that the signal was stripped.
The binding between the content hash, the generating identity,
and the timestamp exists in the registry regardless.

When the content is later hashed — by a court, a regulator,
a journalist, a verification tool — the hash matches the
registry record only if the visible text was reproduced
exactly. If the text was edited, transcribed, or OCR'd, the
hash will not match and the registry cannot link it. The token
binding defeats carrier stripping of exact content; it does
not defeat reproduction of altered content. The generating identity is in that record.
The stripping accomplished nothing forensically.

This is the direct equivalent of the Chilean transit system:
the QR was screenshotted and the visual was stripped of its
meaning, but the server-side record still charged the correct
account because the binding was server-side, not in the visual.

TWO DOCUMENTS, SAME CONTENT, DIFFERENT IDENTITIES:

If the same content is generated by two different AI tools
or accounts, they produce different tokens and different
registry records — different generating_id values. The
verification tool reports both records. The forensic picture
is: this exact content was generated by two different
entities at two different times. Each registration is
independently attributable.

═══════════════════════════════════════════
LAYER 3 — USAGE TRACKING
The signal that fires at verification time
═══════════════════════════════════════════

Every time content is submitted to a verification tool,
that event is logged in the registry alongside the
generation record.

GENERATION EVENT — written once at creation:
token:          lps_a7f3c9e2b4d1f8a3c6e9b2d5f0a3c7e1

content_hash:   e3b0c44298fc1c149afbf4c8996fb924...

generating_id:  claude-sonnet-4 / account_xyz

created_at:     2026-06-20T10:00:00Z

USAGE EVENTS — written at every verification query:

oken:          lps_a7f3c9e2b4d1f8a3c6e9b2d5f0a3c7e1

queried_at:     2026-07-15T14:32:00Z

queried_by:     court-verification-tool / case_ref_abc

query_type:     token  (or: hash_fallback)

The usage timeline becomes forensic evidence alongside
the generation record. A court can see: this content was
generated at time X. It was first submitted for verification
at time Y by a court officer. Nobody submitted it for
verification between generation and the court query. The
person who held the content in that window made no attempt
to verify it through official channels.

HOW THE SIGNAL FIRES WITHOUT THE EMBEDDED TOKEN:

If the embedded signal was stripped by manual removal that
preserves the visible text exactly, the verification tool
computes a content hash and queries the registry by hash —
the hash fallback path from PROPOSAL 001 — and recovers the
record. If the signal was lost through screenshot-plus-OCR or
retyping, the visible bytes have changed, the recomputed hash
matches nothing, and the registry cannot recover it. That case
belongs to the statistical-watermark layer, not to LPS.

query_type: hash_fallback

content_hash: e3b0c44298fc1c149afbf4c8996fb924...

The registry finds the generation record by content hash.
Returns the token, the generating identity, and the
creation timestamp. Logs the usage event. The bypass
is detected and recorded — not prevented, but documented.

THE FORENSIC GAP:

The most powerful forensic signal is the absence of usage
events between generation and a mandatory checkpoint.

Content is generated. Signal is stripped. Content is used
as if human-written. No verification queries are made by
the person using it — because verification would expose
the stripping. A court later queries the content. The
registry shows:

Generation:  2026-06-20T10:00:00Z
First query: 2026-07-15T14:32:00Z  (court officer)
Gap:         25 days, zero voluntary verification events

This gap does not prove the signal was deliberately stripped.
It is forensic evidence that contributes to a larger picture
— the same way the absence of fingerprints at a crime scene
contributes to an investigation without being conclusive alone.

═══════════════════════════════════════════
HOW THE THREE LAYERS WORK TOGETHER
═══════════════════════════════════════════

Layer 1 alone — closes the casual screenshot bypass on
native apps. The determined attacker uses a second device.
Signal stripped. Content used without provenance.

Layer 2 alone — the registry binding exists. The content
hash matches the generation record. Generating identity
confirmed when queried. But no mandatory checkpoint forces
the query to happen.

Layer 3 alone — usage events logged when verification runs.
But if nobody runs verification, no usage events exist.

All three together:
Layer 1 prevents the casual bypass.
Layer 2 makes the bypass detectable when content is queried.
Layer 3 creates a forensic record of when and by whom
the content was verified — and when it was not.

The law provides what the technology cannot: mandatory
verification checkpoints. Court submission, regulatory
filing, publication under disclosure requirements — these
are the turnstiles. LPS is what the turnstile checks.
The registry is what the turnstile records.

═══════════════════════════════════════════
WHAT THIS ADDS BEYOND PROPOSAL 001
═══════════════════════════════════════════

PROPOSAL 001 — passive registry. Records existence and time.
Nobody has to do anything for the record to exist. No usage
tracking. No identity binding.

PROPOSAL 002 — active registry. Records existence, time,
generating identity, and every verification event. The token
binding makes attribution specific — not just "this content
existed" but "this specific AI tool generated this content
for this specific account." Usage tracking makes the forensic
timeline complete — generation, verification history, gaps.

Together they produce a system where:
- Generation is attributed and timestamped
- Every verification event is logged
- Gaps in verification history are detectable
- Stripping the signal does not erase the attribution
- The bypass can succeed technically and still fail forensically

═══════════════════════════════════════════
VERIFICATION FLOW — STEP BY STEP
═══════════════════════════════════════════

Path A — embedded signal survived:
1. Verification tool extracts token from embedded signal
2. Queries registry: GET /registry/record?token=lps_a7f3c9...
3. Registry returns: content_hash, generating_id, created_at
4. Registry logs usage event: token, queried_at, queried_by
5. Verification tool hashes received document
6. Compares computed hash against registry content_hash
7. If match: verified — attribution and timestamp confirmed
8. If no match: failed — content modified after registration

Path B — signal stripped, hash fallback:
1. Verification tool finds no embedded signal
2. Returns degraded — logs attempt
3. Computes content hash from received document
4. Queries registry: GET /registry/record?hash=e3b0c4...
5. Registry returns: token, generating_id, created_at
6. Registry logs usage event: hash_fallback, queried_at
7. Verification tool returns registry_required state with
   full registry record — generating identity, timestamp,
   confirmation that signal was stripped

═══════════════════════════════════════════
OPEN QUESTIONS FOR WORKING GROUP
═══════════════════════════════════════════

1. Generating identity format
   What constitutes a generating_id. AI tool name only.
   AI tool plus account identifier. API key hash. Each
   level of specificity has different privacy implications
   and different forensic value.

2. Usage event privacy
   Usage events log who queried and when. Tier 1 public
   queries — anyone checking content — create a surveillance
   surface. A reader checking whether an article is
   AI-generated creates a log entry. Whether that log
   entry should be retained, for how long, and who can
   access it is a policy question requiring working group
   and legal input.

3. Second-device bypass
   Layer 1 screenshot blocking does not prevent a second
   physical device photographing the screen. Whether any
   technical countermeasure exists for this — or whether
   it is accepted as an irreducible residual risk — requires
   working group input.

4. Mandatory checkpoint definition
   The legal checkpoint — court submission, regulatory
   filing — creates the forced usage event. Which contexts
   constitute mandatory checkpoints under EU AI Act Article
   50 and the August 2026 Code of Practice is a regulatory
   question, not a technical one.

5. Token revocation and usage event handling
   If a generation record is revoked — content published
   in error, legal hold — existing usage events reference
   a revoked record. How the verification tool presents
   a revoked record with existing usage history is undefined.

═══════════════════════════════════════════
v0.1 SCOPE
═══════════════════════════════════════════

Out of scope for reference implementation.
Shares infrastructure with PROPOSAL 001 — same registry,
additional fields and usage event logging.
registry_required state in verificationTool.mjs is the
entry point for this proposal when implemented.
Layer 1 screenshot blocking requires native mobile app
development — separate from the Node.js reference
implementation.

═══════════════════════════════════════════
CONNECTS TO
═══════════════════════════════════════════

PROPOSAL 001 — Notarization Registry. Shared infrastructure.
PROPOSAL 004 — AI Input Verification. Token binding confirms
legitimate provenance of invisible data in received content.
RESEARCH 002 — Cross-Registry Legal Access Framework.
SPEC.md section 6 — Server-Side Record Store.
Anti-forensic principle — signal stripping detectable through
registry gap analysis.
EU AI Act Article 50 — mandatory disclosure requirement that
creates the legal checkpoint this proposal depends on.

## PROPOSAL 003 — Character-Level Provenance Binding
Date: June 2026
Status: OPEN — beyond v0.1, capacity problem unsolved

### Plain terms
Instead of appending one invisible payload block after the visible
text, each visible character gets its own invisible marker attached
to it. If characters are moved, deleted, or inserted, their markers
move or disappear with them. The system can detect not just that
something changed but exactly which characters were affected and
where they were in the original sequence.

### What this enables
Forensic diff at character level. Not just "something changed"
but "character 14 deleted, characters 22-27 moved, 3 characters
inserted at position 9."

### Why it does not exist in c2pa-text today
c2pa-text appends all invisible bytes as one block after the visible
text. No positional relationship between individual visible characters
and individual invisible markers exists in the current spec.

### Unsolved problem
One marker per character multiplies payload size by content length.
A 500 character document requires 500 markers plus the manifest.
This exceeds the 256 byte capacity ceiling of the variation selector
method immediately. A different embedding method would be required.

### Status
Do not build until capacity problem is defined and a viable
embedding method for character-level markers is identified.
Depends on: capacity threshold research from component 0 and 1.


*/=========================================================================================================================================*/

## PROPOSAL 004 — LPS as AI Input Verification Layer
Date: June 2026
Status: OPEN — hypothesis, not yet validated

### Plain terms
AI systems that receive text from users process both visible and
invisible Unicode characters. Invisible characters can carry
malicious payloads — hidden instructions that influence model
behaviour without the human operator seeing them. This attack
class is documented and active.

LPS provides a structural counter. A text with a valid LPS signal
carries legitimate invisible data with a cryptographic signature.
A text with invisible data but no valid LPS signal — or a forged
one — is suspicious by definition.

AI systems with LPS input verification built in would:
1. Attempt to extract and verify any LPS signal in received text
2. If valid: process the text knowing its provenance is confirmed
3. If invalid signature: flag the text as potentially tampered
4. If unverified invisible data present with no LPS signal: strip
   it before processing and flag it as suspicious

### What this adds to LPS positioning
LPS is not only a legal provenance tool. It is a security
primitive for AI input integrity. This repositions LPS from
a content authenticity standard to critical AI security
infrastructure.

### Target audience for this proposal
AI safety researchers, model developers, AI platform security
teams, standards bodies working on AI input integrity.

### Responsible disclosure
Hypothesis reported to Anthropic security team via
security@anthropic.com before any testing.
Testing only performed with explicit permission from the
relevant AI provider.

### Connects to
PROPOSAL 001 — Notarization Registry
RESEARCH 001 — Model Collapse from AI-Trained-on-AI Data
Anti-forensic principle — unverified invisible data is itself
evidence of potential injection attempt.

### Status
Do not build until responsible disclosure process is complete
and testing permission is obtained from at least one AI provider.

## PROPOSAL 005 — Redundant Embedding with Anchor Layer
and Cross-Copy Reconstruction

Status: proposed — post-v0.1

═══════════════════════════════════════════
PROBLEM
═══════════════════════════════════════════

A.9 distributes one manifest as dependent sequential fragments.
Partial copy by the user destroys the payload if any fragment
is missing. No reconstruction is possible from partial fragments.
A single copy embedded once has a single point of failure.

═══════════════════════════════════════════
ARCHITECTURE — TWO LAYERS
═══════════════════════════════════════════

Layer 1 — Anchor Manifest
Layer 2 — Overlapping Redundant Full Manifest Copies

═══════════════════════════════════════════
LAYER 1 — ANCHOR MANIFEST
═══════════════════════════════════════════

A minimal manifest embedded at the start of every paragraph.
Contains document-level fields only:

  text_hash
  overall_ai_proportion
  human_proportion
  algorithm
  signed_at

No segment array. No signature. No cert.
Always fits under A.8 ceiling by design.
Segment array is the primary size driver — its absence
keeps the anchor small regardless of document complexity.

Purpose:
- Survive short copies where no full copy is recoverable
- Confirm expected chunk total and text_hash for reconstruction
  validation
- Provide forensic document-level picture when all full copies
  are lost

Embedded using A.8 — one block per paragraph start character.
Number of anchors = number of paragraphs in document.

═══════════════════════════════════════════
LAYER 2 — OVERLAPPING REDUNDANT FULL MANIFEST COPIES
═══════════════════════════════════════════

Multiple complete copies of the full signed manifest embedded
using A.9 across the document. Each copy is independently
extractable. Copies overlap intentionally to eliminate boundary
vulnerabilities and enable cross-copy reconstruction.

Number of copies:
One complete copy per paragraph. Scales automatically with
document length. A ten paragraph document carries ten copies.

Overlap model — fixed at 25%:
Each copy overlaps the previous copy by 25% of its chunk range.
This is the defined spec value — not calculated dynamically.

Example — 120 chunk manifest, four paragraph document:
  Copy A: chunks 001–040  (paragraphs 1 characters)
  Copy B: chunks 031–070  (paragraph 2 characters)
  Copy C: chunks 061–100  (paragraph 3 characters)
  Copy D: chunks 091–120  (paragraph 4 characters)

Overlap zones:
  Copy A / Copy B overlap: chunks 031–040
  Copy B / Copy C overlap: chunks 061–070
  Copy C / Copy D overlap: chunks 091–100

Every chunk in the overlap zone exists in two independent copies
attached to different visible characters in different paragraphs.
Deleting one paragraph cannot destroy both copies of any
overlapping chunk.

═══════════════════════════════════════════
CHUNK STRUCTURE
═══════════════════════════════════════════

Every A.9 chunk carries a four-field positional header
prepended before the payload bytes:

  seq      uint16  — position of this chunk in the full sequence
  total    uint16  — total chunks in the full sequence
  copy_id  uint8   — which copy this chunk belongs to (A=1, B=2...)
  version  uint8   — header format version, fixed at 1 for v0.1

Header size: 6 bytes per chunk.
Payload bytes follow immediately after the header.
Total chunk size: 6 + payload_slice_size bytes.

The seq number is the universal identifier. Two chunks with
the same seq number from different copy_ids carry identical
payload bytes. The verifier treats them as interchangeable.

═══════════════════════════════════════════
RECONSTRUCTION LOGIC
═══════════════════════════════════════════

Step 1 — Collection
Extract all chunks from all positions in received text.
Group by seq number across all copy_ids.
For each seq position, record all surviving chunks found.

Step 2 — Deduplication
For each seq position, take the first surviving chunk found.
All chunks at the same seq position are identical — any one
is sufficient. copy_id is irrelevant for payload content.

Step 3 — Gap detection
Identify missing seq positions — positions where no chunk
survived in any copy.

Step 4 — Overlap resolution
Overlap zones are known from the fixed 25% model.
For seq positions in overlap zones, check both copies.
If one copy lost the chunk, the other copy's chunk is used.
No special logic required — deduplication in Step 2 handles
this automatically via seq number grouping.

Step 5 — Reassembly decision
If all seq positions 001–total are filled:
  Reassemble payload, decode CBOR, decompress, verify signature.
  Return verified or failed based on signature and text hash.

If majority of seq positions filled but gaps remain:
  Return partial_recovery status.
  Report which seq positions are missing.
  Return all fields that could be reconstructed.
  Note that signature verification cannot run on partial payload.

If no chunks found anywhere:
  Check anchor manifests.
  If anchors present — return anchor_only status.
  If no anchors — check registry.
  If registry empty — return degraded.

═══════════════════════════════════════════
VERIFICATION STATUS — NEW STATES
═══════════════════════════════════════════

anchor_only
  No full manifest copy recoverable.
  Anchor manifests present and consistent.
  Returns: text_hash, overall_ai_proportion, human_proportion,
  algorithm, signed_at.
  Does not return segment breakdown.
  Does not run signature verification.
  Forensic value: document-level provenance confirmed.
  Segment-level detail unavailable.

partial_recovery
  Full manifest partially reconstructed from surviving chunks
  across multiple copies. Not all seq positions filled.
  Returns: all fields successfully reconstructed, list of
  missing seq positions, note that signature verification
  did not run.
  Forensic value: partial segment breakdown available.
  Reconstruction map shows which portions survived.

═══════════════════════════════════════════
SURVIVAL SCENARIOS
═══════════════════════════════════════════

User copies one full paragraph:
  One complete copy recovered. Full verification runs.
  Status: verified or failed.

User copies portion of one paragraph:
  No full copy. Overlap chunks from adjacent copies may be
  present if copied portion included paragraph boundary.
  Cross-copy reconstruction attempted.
  Status: partial_recovery or anchor_only.

User accidentally deletes a sentence mid-paragraph:
  All copies lose chunks attached to deleted characters.
  Overlap zones in adjacent paragraphs fill those gaps.
  If gaps filled — full reconstruction succeeds.
  Anchor text_hash will not match modified text — tamper
  detected at anchor level before reconstruction completes.
  Status: failed with original document-level fields from anchor.

Platform strips all non-standard Unicode:
  All layers lost. Registry fallback only.
  Status: registry_required or degraded.

Adversarial targeted removal:
  Requires extraction tool to identify chunk positions.
  Overlap zones mean each seq position must be removed from
  two different paragraph locations to truly destroy it.
  Labor cost scales with number of paragraphs.
  Status after partial removal: partial_recovery exposes
  the attempt — missing seq positions are reported explicitly.

═══════════════════════════════════════════
CONSTRAINTS
═══════════════════════════════════════════

- Anchor manifest is not cryptographically signed in v0.1.
  Signing the anchor requires a separate signing pass.
  Deferred to v0.2.
- Total payload profiling required before implementation:
  number of copies × manifest size × chunk header overhead
  must be validated against minimum expected document length.
- Reconstruction logic requires verificationTool.mjs update.
- Chunk header format requires embeddingLayer.mjs update.
- extraction output from c2pa-text must expose chunk headers
  or chunking must be implemented above the c2pa-text layer.
- Fixed 25% overlap is the spec value for v0.1 implementation.
  Overlap percentage is not configurable at runtime.

═══════════════════════════════════════════
CONNECTS TO
═══════════════════════════════════════════

PROPOSAL 001 — Notarization Registry
Section 4 — Embedding Layer
Section 4.1 — Compression — chunk header not yet in shortcode
              dictionary, not applicable — header is pre-compression
Section 8 — outstanding test gap: A.9 path not yet tested
Section 9 — open question: multi-round provenance shares
            chunk architecture decisions made here