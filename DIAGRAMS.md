# LPS Diagrams

This file is the visual companion to `ARCHITECTURE.md` and the private `SPEC.md`. It separates the built v0.1 pipeline from future Proposal 005 work.

## 1 Current v0.1 component tree

```mermaid
flowchart TD
    A[Visible text input] --> B[main-pipeline/manifestGenerator.mjs]
    B --> C[main-pipeline/signingLayer.mjs]
    C --> D[main-pipeline/compression.mjs]
    D --> E[main-pipeline/embeddingLayer.mjs]
    E --> F[Encoded text output]

    F --> G[main-pipeline/verificationTool.mjs]
    G --> H[main-pipeline/registryClient.mjs]
    G --> I[Confidence fallback
if needed]
    G --> J[Verification result JSON]

    B --> K[test/testManifest.mjs]
    C --> L[test/testSigning.mjs]
    D --> M[test/testEmbedding.mjs]
    G --> N[test/testVerification.mjs]
    H --> O[test/testRegistry.mjs]
    H --> P[test/testRegistryVerification.mjs]
    I --> Q[test/testConfidenceFallback.mjs]
```

## 2 Current v0.1 data flow

```mermaid
flowchart LR
    T[Plain text] --> H1[Segment mapping]
    H1 --> M1[Manifest JSON]
    M1 --> S1[ES256 signing
P-256 + SHA-256 + IEEE P1363]
    S1 --> C1[Compression]
    C1 --> E1[Text embedding]
    E1 --> X1[Embedded document]

    X1 --> V1[Extraction]
    V1 --> V2[Signature verification]
    V1 --> V3[Text hash verification]
    V1 --> V4[Registry lookup if carrier missing]
    V2 --> R1[verified / failed]
    V3 --> R1
    V4 --> R2[registry_required / degraded]
```

## 3 Trust boundaries

```mermaid
flowchart TD
    subgraph Trusted authoring side
        A[main-pipeline/manifestGenerator.mjs]
        B[main-pipeline/signingLayer.mjs]
    end

    subgraph Transport / document surface
        C[main-pipeline/embeddingLayer.mjs]
        D[Visible text + invisible carrier]
    end

    subgraph Verification side
        E[main-pipeline/verificationTool.mjs]
        F[main-pipeline/registryClient.mjs]
    end

    A --> B --> C --> D --> E --> F
```

## 4 Signing and verification boundary

```mermaid
flowchart TD
    A[Canonical manifest bytes] --> B[Node crypto sign]
    B --> C[Raw r‖s signature
IEEE P1363]
    C --> D[Stored alongside manifest]

    E[Extracted manifest bytes] --> F[Node crypto verify]
    F --> G[Signature valid?]
    G -->|yes| H[Continue verification]
    G -->|no| I[failed]
```

## 5 Verification outcome model for v0.1
```mermaid
flowchart TD
    A[Input document] --> B{Carrier present?}
    B -->|yes| C{Signature valid?}
    C -->|yes| D{Text hash matches?}
    C -->|no| E[failed
no original_manifest]
    D -->|yes| F[verified]
    D -->|no| J{Length within
10% threshold?}
    J -->|yes| K[failed
original_manifest included]
    J -->|no| L[failed
original_manifest withheld]
    B -->|no| G{Registry record found?}
    G -->|yes| H[registry_required]
    G -->|no| I[degraded]
```

Note: the length-threshold branch (J/K/L) reflects the D.6
disclosure-threshold decision, locked and implemented July 3 2026.
A manifest missing `text_length` (a pre-D.6 legacy case, not
currently producible by this codebase) also routes to `failed`
with no disclosure — omitted here to keep the diagram readable;
see `main-pipeline/verificationTool.mjs` STEP 4 for the exact three-way branch.

## 6 Future Proposal 005 flow

```mermaid
flowchart TD
    A[Document text] --> B[Paragraph analysis]
    B --> C[Anchor manifest layer]
    B --> D[Overlapping full-manifest copies]

    C --> E[Anchor HMAC check]
    D --> F[Chunk collection]
    F --> G[Cross-copy reconstruction]
    G --> H[Checksum validation]
    E --> I[anchor_only]
    H --> J[partial_recovery]
    F --> K[injection_detected]
    H --> L[reconstruction_corrupted]
```

## 7 Repository split

```mermaid
flowchart LR
    A[Public LPS repo] --> B[working-group-submission.md]
    A --> C[Proposal / research docs]

    D[Private code repo] --> E[README.md]
    D --> F[SPEC.md]
    D --> G[ARCHITECTURE.md]
    D --> H[Source code + tests]
```

## 8 One-line summary

- Public repo explains what LPS is.
- Private repo explains how the reference implementation works.
- v0.1 is built.
- Proposal 005 is specified but not yet built.
