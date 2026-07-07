import { embedManifest } from './embeddingLayer.mjs';
import { signManifest } from './signingLayer.mjs';
import { generateManifest } from './manifestGenerator.mjs';
import { verifyManifest } from './verificationTool.mjs';
import { evaluateDisclosureThreshold } from './verificationTool.mjs';
/*
 * [J.1] WHAT THIS FILE DOES
 * This is the most important test in the suite.
 * It runs the entire pipeline end to end — Stages 1, 2, and 3 to build
 * the document, then Stage 4 to verify it — and then runs it a second time
 * on a deliberately tampered version of the same document.
 * Two runs. Two expected outcomes.
 * First: verified. Second: failed.
 * If both come back as expected, the full system works — including its
 * ability to detect modification after signing.
 */

/*
 * [J.2] BUILDING THE TEST DOCUMENT — STAGES 1, 2, 3
 * A short two-segment text: one human segment, one AI segment.
 * The boundary is at character 21 — "This is human written." ends there.
 * Everything from 22 onward is ai_generated.
 * generateManifest() builds the record. signManifest() seals it.
 * embedManifest() hides it inside the text.
 * embeddedText is the finished document — what a real system would distribute.
 */

const visibleText = "This is human written. This part was AI generated.";

const manifest = generateManifest({
  visibleText,
  segments: [
    { segmentId: 1, startOffset: 0, endOffset: 21, origin: 'human', confidence: 0.95 },
    { segmentId: 2, startOffset: 22, endOffset: 49, origin: 'ai_generated', confidence: 0.88, aiTool: 'claude-sonnet' }
  ],
  signingTool: 'lps-reference-implementation-v0.1',
  signedAt: new Date().toISOString()
});

const signedManifest = signManifest(manifest);
const embeddedText = embedManifest(visibleText, signedManifest);

(async () => {

/*
 * [J.3] RUN 1 — THE CLEAN VERIFICATION
 * verifyManifest() receives the untampered embeddedText.
 * It runs all four internal steps: extract, decode, verify signature,
 * verify text hash. Nothing has been touched since embedding.
 * Expected output: status "verified" with the full segment breakdown,
 * proportions, algorithm, and signed_at timestamp.
 * This run proves the happy path works — a legitimate document
 * produced by the pipeline verifies cleanly on the other end.
 */

console.log('--- Verification result ---');
const result = await verifyManifest(embeddedText, { allowLocalCert: true });
console.log(JSON.stringify(result, null, 2));

const expectedSegments = [
  { segment_id: 1, origin: 'human', start_offset: 0, end_offset: 21, confidence: 95 },
  { segment_id: 2, origin: 'ai_generated', start_offset: 22, end_offset: 49, confidence: 88, ai_tool: 'claude-sonnet' }
];

const segmentsMatch = Array.isArray(result.segments)
  && result.segments.length === expectedSegments.length
  && expectedSegments.every((expected, i) => {
    const actual = result.segments[i];
    return actual
      && actual.segment_id === expected.segment_id
      && actual.origin === expected.origin
      && actual.start_offset === expected.start_offset
      && actual.end_offset === expected.end_offset
      && actual.confidence === expected.confidence
      && (expected.ai_tool === undefined || actual.ai_tool === expected.ai_tool);
  });

console.log(
  result.status === 'verified' && segmentsMatch
    ? 'PASS' : 'FAIL',
  '(clean verification: verified status, segment content matches input — origin, offsets, confidence, ai_tool)'
);

/*
 * [J.4] RUN 2 — THE ADVERSARIAL TEST
 * " TAMPERED" is appended directly to embeddedText — a fixed-string
 * append, not a delta calculated against any target percentage. On
 * this test's specific visibleText length, it lands past the 10%
 * disclosure threshold, which is what this case is actually checking:
 * a large enough mismatch that original_manifest is withheld. It is
 * not a controlled "18% delta" case — that number should not appear
 * elsewhere describing this test.
 * The invisible signal is still inside the text — it was not removed.
 * The signed manifest is still there — it was not altered.
 * But the visible text is now different from the text that was hashed
 * at Stage 1 and recorded in the manifest as text_hash.
 *
 * What verifyManifest() will do with this:
 * Step 1 — extraction succeeds. The signal is still present.
 * Step 2 — decoding succeeds. The manifest comes out intact.
 * Step 3 — signature verification passes. The manifest was not modified.
 * Step 4 — text hash check fails. The received text hashes to a different
 *           value than the one stored in the manifest. The appended string
 *           changed the fingerprint. The mismatch is caught.
 *
 * Expected output: status "failed", reason stating the content hash
 * does not match, and the original_manifest block showing what the
 * document looked like at signing time — before the tampering occurred.
 *
 * Plain English: the signature on the manifest is still valid.
 * The manifest itself was not touched. But the text it describes
 * is no longer the text being presented. The system catches that
 * and reports exactly what happened and what the original looked like.
 * That is the adversarial guarantee. This run proves it holds.
 */

console.log('--- Adversarial test: tampered text ---');
const tamperedText = embeddedText + " TAMPERED";
const tamperedResult = await verifyManifest(tamperedText, { allowLocalCert: true });
console.log(JSON.stringify(tamperedResult, null, 2));
console.log(
  tamperedResult.status === 'failed' && tamperedResult.original_manifest === undefined
    ? 'PASS' : 'FAIL',
  '(large-mismatch: failed status, original_manifest withheld — beyond 10% threshold)'
);

/*
 * [K.1] SMALL-EDIT DISCLOSE CASE
 * A single-character edit on the 50-character visibleText is a ~2%
 * length delta — well under the 10% threshold. This is the exact
 * path that was broken (H.5): evaluateDisclosureThreshold() correctly
 * returns disclose: true, but the dead duplicate code in
 * verificationTool.mjs referenced undeclared variables at that point
 * and would have thrown ReferenceError before this fix. This case
 * exercises the real pipeline, not the isolated pure-function calls
 * below, because the isolated calls never reach that code path.
 */
console.log('\n--- Small-edit test: disclose expected ---');
const smallEditText = embeddedText + "!";
const smallEditResult = await verifyManifest(smallEditText, { allowLocalCert: true });
console.log(JSON.stringify(smallEditResult, null, 2));
console.log(
  smallEditResult.status === 'failed' && smallEditResult.original_manifest !== undefined
    ? 'PASS' : 'FAIL',
  '(small-edit: failed status, original_manifest disclosed)'
);

})();
// The entire async block is wrapped in an immediately invoked async function
// because verifyManifest() is async — it fetches the certificate over the network.
// Top-level await is available in .mjs files but the IIFE makes the async
// boundary explicit and keeps both test runs inside the same execution scope.

/*
 * [D.6 UNIT TESTS] evaluateDisclosureThreshold — direct calls
 * These bypass signing, embedding, and extraction entirely.
 * Closes the gap identified in [D.2]: no real pipeline input can
 * produce a manifest missing text_length, so this scenario can
 * only be tested by calling the extracted function directly.
 */

console.log("=== evaluateDisclosureThreshold — direct unit tests ===\n");

console.log("--- Case 1: missing text_length ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: undefined, receivedLength: 500 });
  console.log(result.disclose === false && result.reason === 'missing_text_length' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 1b: null text_length ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: null, receivedLength: 500 });
  console.log(result.disclose === false && result.reason === 'missing_text_length' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 2: within threshold (5% delta) ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: 1000, receivedLength: 1050 });
  console.log(result.disclose === true && result.reason === 'within_threshold' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 2b: exact 10% boundary (inclusive) ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: 1000, receivedLength: 1100 });
  console.log(result.disclose === true && result.reason === 'within_threshold' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 3: exceeds threshold (20% delta) ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: 1000, receivedLength: 1200 });
  console.log(result.disclose === false && result.reason === 'exceeds_threshold' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 3b: just past 10% boundary ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: 1000, receivedLength: 1101 });
  console.log(result.disclose === false && result.reason === 'exceeds_threshold' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 4: zero-length signed text, exact match ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: 0, receivedLength: 0 });
  console.log(result.disclose === true && result.reason === 'within_threshold' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n--- Case 4b: zero-length signed text, any mismatch ---");
{
  const result = evaluateDisclosureThreshold({ signedLength: 0, receivedLength: 1 });
  console.log(result.disclose === false && result.reason === 'exceeds_threshold' ? "PASS" : "FAIL", JSON.stringify(result));
}

console.log("\n=== End evaluateDisclosureThreshold unit tests ===");

console.log("\n--- [D.6 regression] text_length missing — guard fires, not NaN fallthrough ---");
console.log("SKIPPED — no code path in this codebase produces a manifest without text_length.");
console.log("Guard is present in verificationTool.mjs STEP 4 (see D.1 comment in source).");
console.log("Revisit only if a legacy-manifest migration path is ever introduced.");
