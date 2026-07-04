import { generateManifest } from './manifestGenerator.mjs';

/*
 * [G.1] WHAT THIS FILE DOES
 * This is the test for Stage 1 — manifestGenerator.mjs.
 * It constructs a controlled, predictable input and passes it directly
 * to generateManifest(). The output is printed to the terminal as formatted JSON.
 * No assertions, no pass/fail logic. The test passes if the output looks correct
 * and the proportions match what you can verify by hand from the input.
 * This is a human-readable proof that Stage 1 works.
 */

/*
 * [G.2] THE TEST INPUT — VISIBLE TEXT
 * 'A'.repeat(501) produces a string of 501 identical characters.
 * The content is meaningless by design — this is not testing language,
 * it is testing math. Using a single repeated character makes the
 * character counts and offsets trivially verifiable by hand.
 * 501 characters total. Offsets run from 0 to 500.
 */

const visibleText = 'A'.repeat(501);

/*
 * [G.3] THE THREE SEGMENTS — WHAT THEY COVER AND WHY
 * Three segments are defined, each covering a different origin type.
 * Together they cover all 501 characters with no gaps and no overlaps.
 * This is intentional — it tests that the manifest handles all three
 * origin values and that the proportion calculation accounts for
 * the full character range correctly.
 *
 * Segment s001: characters 0–200. 201 characters. Origin: human.
 *   No ai_tool. No modification_degree. These fields must be absent
 *   from the manifest output for this segment — their absence confirms
 *   the conditional logic in generateManifest() works correctly.
 *
 * Segment s002: characters 201–400. 200 characters. Origin: ai_generated.
 *   ai_tool is present — required for any AI-origin segment.
 *   No modification_degree — ai_generated has no human source to measure against.
 *
 * Segment s003: characters 401–500. 100 characters. Origin: ai_modified_human.
 *   ai_tool present. modification_degree: 0.3 — meaning 30% of the human
 *   text in this segment was altered by the AI. Both fields must appear
 *   in the output. This is the only origin type that carries modification_degree.
 *
 * Expected proportions from these numbers:
 * Total: 501 characters.
 * AI characters (s002 + s003): 200 + 100 = 300. 300/501 ≈ 0.6.
 * Human characters (s001): 201. 201/501 ≈ 0.40.
 * These are the values overall_ai_proportion and human_proportion
 * should show in the output. Verify them by reading the printed JSON.
 */

const result = generateManifest({
  visibleText,
  segments: [
    {
      segmentId: "s001",
      startOffset: 0,
      endOffset: 200,
      origin: "human",
      confidence: 0.95
      // No aiTool. No modificationDegree. Must be absent from output.
    },
    {
      segmentId: "s002",
      startOffset: 201,
      endOffset: 400,
      origin: "ai_generated",
      aiTool: "claude-sonnet-4",
      confidence: 0.98
      // aiTool present. No modificationDegree — ai_generated does not carry it.
    },
    {
      segmentId: "s003",
      startOffset: 401,
      endOffset: 500,
      origin: "ai_modified_human",
      aiTool: "claude-sonnet-4",
      modificationDegree: 0.3,
      confidence: 0.87
      // Both aiTool and modificationDegree present. Only origin type that carries both.
    }
  ],
  signingTool: "lps-reference-implementation-v0.1",
  signedAt: "2026-06-10T00:00:00Z"
  // signingTool and signedAt are passed through unchanged — generateManifest() records
  // them but does not compute or validate them. They appear in the output as given.
});

/*
 * [G.4] THE OUTPUT
 * JSON.stringify(result, null, 2) prints the manifest as formatted JSON.
 * null = no field filtering. 2 = two-space indentation.
 * What to look for in the terminal output:
 *   — lps_version: "0.1"
 *   — text_hash: a 64-character hex string. Unique to this exact visibleText.
 *     Run the test twice — the hash must be identical both times.
 *     Change one character in visibleText and re-run — the hash must change.
 *   — text_length: 501, matching visibleText.length exactly.
 *   — content_segments: three entries, one per segment defined above.
 *     s001 must have no ai_tool and no modification_degree.
 *     s002 must have ai_tool, no modification_degree.
 *     s003 must have both ai_tool and modification_degree.
 *   — overall_ai_proportion ≈ 0.6
 *   — human_proportion ≈ 0.4
 *   — signing_tool and signed_at exactly as passed in.
 */

console.log(JSON.stringify(result, null, 2));