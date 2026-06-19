## RESEARCH 001 — Model Collapse from AI-Trained-on-AI Data
Date: June 2026
Status: OPEN — strategic framing, not a build question

### The question
If the majority of internet content becomes AI-generated and
non-verifiable, future models trained on that corpus will be
trained on outputs of previous models rather than verified human
knowledge. What are the documented consequences of this and what
does existing research say about the trajectory?

### Why it matters for LPS
Provenance infrastructure becomes critical not only for human
readers and legal proceedings but for the integrity of future
training pipelines. A corpus of content with verified provenance
signals — human-written, AI-generated, AI-modified — is a
structurally cleaner training dataset than an unverified corpus.
LPS is not just a verification tool for humans. It is potentially
a data quality layer for AI training pipelines.

### Why it matters for positioning
This reframes LPS from a content authenticity tool to critical
infrastructure for the long-term health of AI systems themselves.
That is a different conversation with a different set of decision
makers — AI safety researchers, model developers, and standards
bodies, not just media organizations and legal teams.

### Where to research
- Search: "model collapse AI generated training data" — multiple
  papers published 2023-2025 on recursive model degradation
- Search: "data provenance machine learning training pipelines"
- C2PA working group documentation on verified content datasets
- EU AI Act provisions on training data transparency

### What to bring back
- Is model collapse from synthetic training data empirically confirmed
  or still contested?
- Are any major labs already filtering training data by provenance
  signals?
- Has anyone proposed a provenance-verified corpus as a training
  data standard?

### Status
Not a build question. Do not open this research until after v0.1
reference implementation is complete and working group engagement
has begun. At that point this research informs the positioning
conversation, not the technical architecture.





## RESEARCH 002 — Legal Framework for Cross-Registry Access
Date: June 2026
Status: OPEN — regulatory and industry framework does not exist yet

### The question
What legal framework governs a third-party verification tool
querying AI company notarization registries? Who grants access,
under what conditions, and through what mechanism?

### Why it matters for LPS
The verification tool has two paths — embedded signal and registry.
The embedded signal path requires no external access. The registry
path requires querying records owned by AI companies or institutions.
Without a defined access framework, the registry path only works
against the LPS registry itself, not against external registries.

### Current state
No major AI company has a public notarization registry today.
The question of access is currently theoretical. No registry exists
to query. The framework needs to be defined before registries exist
so that when they are built, access models are already established.

### Three possible access models
Model 1 — Public API. Open to anyone, no credentials.
Precedent: Certificate Transparency logs.
Model 2 — Credentialed API. Requires registration and terms agreement.
Precedent: most commercial APIs.
Model 3 — Restricted API. Requires legal authority.
Precedent: law enforcement database requests.

### For the forensic use case
A judge using the verification tool would need Model 3 access
to AI company registries. The tool submits a formal data request
through whatever access mechanism regulation provides.
The tool does not bypass access controls. It uses the official path.

### LPS opportunity
LPS can propose a cross-registry access standard as part of its
working group submission. Proposing the framework before it exists
positions LPS as infrastructure, not just a tool.

### Where to research
- EU AI Act provisions on data access and transparency obligations
- Certificate Transparency RFC 6962 — public log access model
- GDPR data access request framework — Article 15
- Existing law enforcement API access frameworks

### Status
Do not resolve before working group engagement begins.
This is a policy and regulatory question, not a build question.
Bring it to the working group as an open proposal, not a solution.


## RESEARCH 003 — Infrastructure Cost and Secrets Management
Date: June 2026
Status: DEFERRED — post-v0.1 concern

### What this covers
- Secrets manager selection: AWS Secrets Manager vs HashiCorp Vault
- CA-issued certificate cost and tier selection
- Company registration requirement for Organization Validation certificate
- Vercel environment variable limits for production key storage

### When to open this
After reference implementation is complete and working group
engagement has begun. Before any production deployment or
client contract is signed.

### Cost estimates logged
AWS Secrets Manager: ~$0.40 per secret per month
HashiCorp Vault managed: ~$0.03 per hour
CA certificate Organization Validation: ~$100-300 per year
CA certificate Domain Validation: ~$10-100 per year

### Decision to make at that point
- Which secrets manager fits Systemactic infrastructure
- Whether to register Systemactic as legal entity before or after
  working group submission
- Which CA to use for production certificate
