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
