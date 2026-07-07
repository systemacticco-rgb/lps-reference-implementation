# LPS Survival Test Log

## Purpose

Manual record of copy/paste survival tests for LPS text carriers.
Each row records whether the embedded manifest survived a specific
editor or transport path, whether the signature still verified, and
whether the visible text changed.

## Baseline

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Repo | lps-reference-implementation |
| Local rig | lps-local-test-server.mjs |
| Embed path | A.8 invisible Unicode variation selectors |
| Expected clean result | verified |
| Expected manifest removed result | degraded |
| Expected visible text edit result | failed |

## Test Matrix

| Date | Editor / App | Platform | Copy Path | Embedding Method | Visual Text Changed | Manifest Survived | Signature Survived | Status | Notes |
|---|---|---|---|---|---:|---:|---:|---|---|
| 2026-07-06 | Local rig only | macOS / browser | copy embedded → paste verifier | A.8 | false | true | true | verified | Baseline pass |
| 2026-07-06 | Google Docs | macOS / browser | rig → Docs → rig verifier | A.8 | false | true | true | verified | Variation selectors survived |
| 2026-07-06 | Manual manifest removal | local | remove invisible carrier | A.8 | false | false | false | degraded | Expected |
| 2026-07-06 | Manual visible edit | local | append visible char | A.8 | true | true | true | failed | Expected text_hash mismatch |

## Raw Survival Rows

Paste full JSON survival rows here when needed.

### 2026-07-06 — Google Docs

```json
{}