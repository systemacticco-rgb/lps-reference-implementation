import assert from 'node:assert/strict';
import { generateManifest } from './manifestGenerator.mjs';
import { signManifest } from './signingLayer.mjs';

const visibleText = 'A'.repeat(401);
const contentSignedAt = '2026-08-02T00:00:00.000Z';

const manifest = generateManifest({
  visibleText,
  segments: [
    {
      segmentId: "s001",
      startOffset: 0,
      endOffset: 200,
      origin: "human",
      confidence: 0.95
    },
    {
      segmentId: "s002",
      startOffset: 201,
      endOffset: 400,
      origin: "ai_generated",
      aiTool: "claude-sonnet-4",
      confidence: 0.98
    }
  ],
  signingTool: "lps-reference-implementation-v0.1",
  contentSignedAt
});

assert.equal(manifest.content_signed_at, contentSignedAt);
assert.equal(Object.hasOwn(manifest, 'signed_at'), false);

const signed = signManifest(manifest);

assert.equal(signed.ev, 1);
assert.equal(signed.manifest.content_signed_at, contentSignedAt);
assert.equal(typeof signed.signed_at, 'string');
assert.ok(signed.signed_at.length > 0);
assert.equal(typeof signed.signature, 'string');
assert.ok(signed.signature.length > 0);

console.log('PASS signing envelope assertions');

/*
 * [Y.1 TEST] SIGNING_ENABLED killswitch
 * signManifest() must refuse to run before any key access when
 * SIGNING_ENABLED is not exactly the string 'true', and must proceed
 * normally when it is. This guards against signing running with the
 * kill-switch off due to a misconfigured or missing environment
 * variable — the check is deliberately strict string equality, not
 * truthy/falsy, so values like '1', 'yes', or an empty string all
 * correctly fail closed.
 */

console.log('--- SIGNING_ENABLED killswitch test ---');

const originalSigningEnabled = process.env.SIGNING_ENABLED;

// Case 1: unset entirely
delete process.env.SIGNING_ENABLED;
try {
  signManifest(manifest);
  console.log('FAIL (unset should have thrown)');
} catch (e) {
  console.log(
    e.message === 'Signing disabled: SIGNING_ENABLED is not set to true'
      ? 'PASS' : 'FAIL',
    '(unset — threw expected killswitch error)'
  );
}

// Case 2: explicitly false
process.env.SIGNING_ENABLED = 'false';
try {
  signManifest(manifest);
  console.log('FAIL (false should have thrown)');
} catch (e) {
  console.log(
    e.message === 'Signing disabled: SIGNING_ENABLED is not set to true'
      ? 'PASS' : 'FAIL',
    '(false — threw expected killswitch error)'
  );
}

// Case 3: enabled — must proceed past the guard (may still throw later
// for unrelated reasons, e.g. missing private.pem, unreadable cert.pem,
// or mismatched local signing material; those are different, acceptable
// failures for this case — it only confirms the killswitch itself did
// not block it)
process.env.SIGNING_ENABLED = 'true';
try {
  signManifest(manifest);
  console.log('PASS (true — signing proceeded, manifest signed)');
} catch (e) {
  console.log(
    e.message !== 'Signing disabled: SIGNING_ENABLED is not set to true'
      ? 'PASS' : 'FAIL',
    `(true — killswitch did not block; downstream error if any: ${e.message})`
  );
}

// restore original environment state
if (originalSigningEnabled === undefined) {
  delete process.env.SIGNING_ENABLED;
} else {
  process.env.SIGNING_ENABLED = originalSigningEnabled;
}
