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

The registry is the only verification layer that survives
transcription, screenshot, and signal stripping. If a
document is photographed, OCR'd, retyped, or otherwise
converted through an analog process — all embedded signals
are destroyed. The content hash remains computable from
the resulting text. If the text matches the registry record,
origin is confirmed even without any embedded signal.

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
Status: OPEN — pending component 0 and component 1 completion

### Origin
Chilean public transit QR system. Screenshot of QR returns black
screen — render-blocked at OS or app level. Bypass attempt still
resulted in fare deduction, confirming the token was server-bound
and user-specific independent of visual capture.

### Plain terms
The manifest is not only embedded in the text. At generation time,
a unique token is registered server-side, bound to the specific
output and the generating identity. If the embedded signal is
stripped — by screenshot, copy-paste truncation, or any other
method — the server-side token remains. A presented piece of content
can be checked against the token registry to establish origin even
when no embedded signal survives.

### What this adds beyond the embedding layer
The embedding layer (c2pa-text, Unicode variation selectors) survives
copy-paste but not screenshot or OCR transcription. The server-side
token survives all of those because it is not inside the content.
It is a parallel record that exists independently of what happens
to the content after delivery.

### LPS architectural question
Can the manifest generator register a token at signing time,
not just embed a manifest in the text? If yes, verification has
two independent paths: extract from content, or query the registry.
Degraded signal becomes recoverable through the registry path.

### Connects to
PROPOSAL 001 — Notarization Registry. Same server-side infrastructure.
Token binding and notarization are two functions of the same registry.
Anti-forensic principle — stripping the embedded signal does not
erase the server-side record. The act of stripping becomes detectable
by comparing registry presence against embedded signal absence.
SPEC.md section 6 — Server-Side Record Store.

### v0.1 scope
Out of scope for reference implementation.
Required before working group submission.
Architecture decision pending: foundation-hosted vs federated registry.

### Open questions
- Token format: hash of content only, or hash plus signer identity
  plus timestamp combined?
- Registry access: public lookup or credentialed only?
- What happens when the same content is legitimately re-published
  by a different party — does it get a new token or inherit the
  original?

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