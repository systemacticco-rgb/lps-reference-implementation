# LPS Reference Implementation — Technical Specification
Version: 0.1-draft
Status: Skeleton — sections marked [DEFINED], [PLACEHOLDER], [SECURITY-CRITICAL]

---

## 0. Principles
- Security above all other concerns
- One component per file, one concern per function
- No mixed responsibilities
- Audited libraries only — no custom cryptographic implementations
- Every function must be independently testable
- AI agents follow this spec exactly — no assumptions outside scope

---

## 1. Input Format [PLACEHOLDER]
What the manifest generator receives as input.
- Content: string (plain text for v0.1)
- Segments: array — start offset, end offset, origin type
- Origin types: "human" | "ai_generated" | "ai_modified_human"
- AI tool identifier: string
- Modification degree: float 0-1 (required for ai_modified_human only)
- Timestamp: ISO 8601

Open question: how does the tool know segment boundaries?
Approach 1 — provided by the AI tool at creation time [PREFERRED]
Approach 2 — estimated post-hoc by detection layer [FALLBACK]

---

## 2. Manifest Schema [DEFINED]
Defined in README.md section 3.2.
Reference that file. Do not duplicate here.
Any schema changes must be made in README.md first,
then reflected here.

---

## 3. Signing Layer [SECURITY-CRITICAL] [PLACEHOLDER]
Algorithm: [TO BE DECIDED — candidate: Ed25519]
Library: Node.js built-in crypto module
Key format: [TO BE DECIDED]
Certificate handling: self-signed for v0.1, CA-issued for production
Constraint: never implement signing logic manually
Constraint: key material never logged, never hardcoded
Constraint: signing and verification are separate files,
           separate functions, zero shared mutable state

Open questions:
- Which algorithm — Ed25519 vs ECDSA P-256?
- Key storage for v0.1 proof of concept?
- Self-signed certificate generation process?

---

## 4. Embedding Layer [DEFINED — infrastructure exists]
Library: encypherai/c2pa-text (MIT licensed)
Method for v0.1: Unstructured A.8 — Unicode Variation Selectors
Reason: survives copy-paste, sufficient for proof of concept
Fallback: Structured A.9 if manifest exceeds capacity constraint
Constraint: embedding and extraction are separate functions
Constraint: never modify content during embedding

Known limitation: Unicode variation selectors have data capacity ceiling.
Complex manifests with many segments may require fallback method.
Capacity threshold: [TO BE TESTED]

---

## 5. Verification Tool [PLACEHOLDER]
Input: file or text string with embedded manifest
Steps in order:
1. Extract manifest from content
2. Check signature against public key
3. Check certificate validity
4. Render contribution breakdown

Output — passing result: [TO BE DEFINED]
Output — failing result: [TO BE DEFINED]
Output — degraded result (partial signal): [TO BE DEFINED]

Constraint: verification never modifies the input
Constraint: certificate revocation check is mandatory,
           not optional — lesson from UMBC paper

---

## 6. Server-Side Record Store [PLACEHOLDER — component 4]
Architecture decision pending: foundation-hosted vs federated
Not required for v0.1 proof of concept
Required before working group submission

---

## 7. Security Constraints — Global [SECURITY-CRITICAL]
These apply to every component without exception:

- No cryptographic algorithm implemented from scratch
- No key material in logs, console output, or error messages
- No mixed concerns — each file has one job
- All dependencies pinned to specific versions
- All dependencies checked against known vulnerability databases
  before use
- Certificate revocation checking is mandatory
- Input validation on every entry point
- Error messages must not leak internal state

---

## 8. Test Requirements [PLACEHOLDER]
Each component requires:
- Unit test for expected input
- Unit test for malformed input
- Unit test for adversarial input (tampered manifest,
  invalid signature, stripped signal)
- Output must be deterministic for identical inputs

---

## 9. Open Questions — Blocking
These must be resolved before building the signing layer:
- [ ] Signing algorithm selection
- [ ] Key storage method for v0.1
- [ ] Capacity threshold for Unicode variation selectors
- [ ] Passing/failing/degraded output format

---

## 10. Change Log
v0.1-draft — June 2026 — skeleton created
