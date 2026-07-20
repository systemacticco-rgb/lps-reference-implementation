## PROPOSAL 006 — Hash-Only Carrier with Registry Retrieval
*Proposed: 2026-07-19 | Status: Under Architectural Review | Not yet adopted*

---

**What this proposal intends to do**

Instead of embedding the full signed manifest into the text artifact via A.8 Unicode variation selectors, the AI tool embeds only a SHA-256 hash of that manifest — approximately 32 bytes, 64 hex characters — at generation time. The hash is the only in-band signal. The full manifest is stored in the LPS registry at generation time and retrieved by any verifier that presents the recovered hash as a lookup key. The registry returns the complete manifest: segment breakdown, confidence values, AI tool identifier, timestamp, signature, and all provenance fields.

---

**What it solves**

The carrier payload drops from 700–2,000+ bytes to 32 bytes. A 32-byte payload encoded as Unicode variation selectors occupies roughly 64–128 codepoints — a fraction of the current A.8 footprint. A smaller payload survives stripping pipelines more aggressively. There is simply less to strip, and the signal is less recognizable as structured data to a naive heuristic that would otherwise flag a CBOR blob. Code block survival probability increases meaningfully: fewer codepoints produce fewer or no U+FFFD tofu characters, and at small enough sizes some renderers pass the payload silently without flagging it. The proposal directly addresses the two most acute survival failures in the current system — code block corruption and LLM-side stripping — by reducing the carrier to its minimum viable size.

---

**What it breaks and what it costs**

The manifest no longer exists inside the text. A document intercepted without registry access is forensically opaque — no provenance information is recoverable from the text itself. This is a structural regression from the current system, where a degraded or partial manifest still yields recoverable forensic fields.

PROPOSAL 005's redundant reconstruction architecture is largely invalidated. Cross-copy chunk reconstruction, anchor manifests, and partial recovery are all predicated on manifest bytes surviving in fragments. A hash does not fragment usefully. One bit of corruption invalidates the entire registry lookup. There is no partial hash. The forensic reconstruction percentage the developer wants to surface becomes binary: hash present and matched returns 100%, hash absent or corrupted returns 0%. The graduated damage-degree forensic output is lost.

The registry moves from supplementary fallback to mandatory infrastructure. Under the current system, registry lookup is the `registry_required` state — a secondary signal when the primary in-band manifest is absent. Under PROPOSAL 006, every verification of every document requires a live registry call. There is no offline verification path. A document is unverifiable without network access to the registry.

The adversarial surface changes in an unfavorable direction. Under the current system, an adversary who strips the manifest produces a document in the `degraded` state — the absence of signal is itself a forensic finding, and partial survival still yields partial information. Under PROPOSAL 006, an adversary who strips the 32-byte hash produces a document with no surviving provenance signal and no degraded-state forensic output. Stripping becomes cheaper and its forensic consequence disappears.

---

**Comparison against PROPOSAL 005**

PROPOSAL 005 and PROPOSAL 006 solve opposite ends of the same problem and are structurally incompatible as co-primary strategies.

PROPOSAL 005 increases survival probability by increasing redundancy — multiple overlapping copies of the full manifest, anchor layers, cross-copy reconstruction, and partial recovery states. It accepts a larger total payload in exchange for resilience against partial stripping. Its forensic value scales with what survives: more surviving chunks produce a more complete breakdown.

PROPOSAL 006 increases survival probability by decreasing payload size — a single minimal signal that either survives intact or does not survive at all. It accepts total forensic dependency on the registry in exchange for a smaller attack surface for stripping. Its forensic value is binary.

These are not complementary. Deploying both simultaneously produces a system where the small hash survives when the large redundant payload does not, but the hash alone carries no forensic information — it only triggers a registry fetch. The only scenario where both proposals are simultaneously useful is one where the hash survives and the registry is available, which is also the scenario where PROPOSAL 005 was not needed. PROPOSAL 005 is motivated by the case where the registry is unavailable or the signal is partially degraded. PROPOSAL 006 eliminates both of those cases as meaningful forensic scenarios.

---

**Registry infrastructure cost**

The hash-registry model trades carrier complexity for registry dependency. The registry dependency is the harder adoption blocker. The developer's own research notes that frontier AI labs have declined to deploy hash-registry architectures at scale because the infrastructure cost of registering and serving trillions of hashes per day is not justified against the security value, particularly when the scraping and normalization pipelines that consume AI-generated text do not yet have standardized mechanisms to query a hash ledger before processing. This constraint applies directly here. LPS cannot compel registry participation. It can define the protocol and submit it to the working group. But a hash-only carrier that depends on a registry that AI providers are unwilling to fund and maintain at scale is an adoption architecture, not a technical architecture.

---

**Narrow application — code blocks only**

The hash-registry model applied exclusively to code block artifacts — not as a replacement for A.8 in plain text — is a materially different proposal with a better cost profile. Plain text provenance remains self-contained via A.8. The registry dependency is scoped to code block verification only. Code block forensics become binary, but code block forensics are already binary under the current system because the current system has no viable code block carrier at all. A binary forensic outcome for code blocks is better than no forensic outcome, which is the current state. This scoped application does not invalidate PROPOSAL 005 and does not require replacing the existing pipeline.

---

**Open questions this proposal defers to the working group**

Whether the registry is foundation-hosted or federated is not a decision the LPS reference implementation can make. Whether AI providers will register hashes at generation time is a regulatory or contractual question, not a technical one. Whether a hash-only carrier satisfies the forensic admissibility requirements that motivate the system's legal use cases — given that it produces no recoverable in-band evidence when the registry is unavailable — requires legal and forensic input that is outside the current scope.

*This proposal remains under architectural review. No implementation. No documentation changes. Deferred to working group engagement phase.*