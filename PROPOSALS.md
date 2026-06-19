## PROPOSAL 001 — Server-Side Notarization Registry
Date: June 2026
Status: ASSESSED — deferred to post-v0.1

### Plain terms
Every AI-generated output gets a hash plus timestamp written to a
server-side append-only log at generation time. The content itself
is not stored — only the fingerprint. A presented document can later
be checked against this log to confirm it existed, unchanged, at a
specific moment.

### Access model
Tiered read access. Log is not public. Read access requires
credentialed authority — legal, governmental, or institutional.
Consumer layer has no access. This is intentional.

### Forensic value
Survives transcription. Only layer that does. Not proof of authorship.
Corroborating forensic evidence for legal proceedings.
Primary use case: court admissibility support, not consumer verification.

### What it connects to
SPEC.md section 6 — Server-Side Record Store.
Currently [PLACEHOLDER]. This proposal defines what that component is.

### Why it requires major AI company integration
Hash must be written at generation time, server-side, by the model
provider. Cannot be retrofitted by a third party after output is
delivered. Google, Anthropic, OpenAI, Meta must integrate this at
the generation layer. LPS reference implementation demonstrates the
architecture. Adoption requires regulatory mandate or voluntary
commitment from providers.

### v0.1 scope
Out of scope. Supabase append-only table is technically buildable now.
Credentialed access layer requires institutional relationships and
legal framework design. Not a code problem at this stage.

### Connects to
Hypothesis E (QR server-side binding) — same server-side trace logic.

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
