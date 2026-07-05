import { registerContent } from './registryClient.mjs';

/*
 * [Registry input validation] contentHash and generatingId checks
 * Both validations in registerContent() throw synchronously before
 * any Supabase call — these cases confirm that boundary is enforced
 * correctly on invalid input, and does not require a live database
 * connection to test.
 */

console.log('--- Registry input validation tests ---');

const VALID_HASH = 'a'.repeat(64);
const VALID_ID = 'test-generating-id-001';

async function expectThrow(label, fn, expectedSubstring) {
  try {
    await fn();
    console.log('FAIL', `(${label} — expected throw, none occurred)`);
  } catch (e) {
    console.log(
      e.message.includes(expectedSubstring) ? 'PASS' : 'FAIL',
      `(${label} — threw: ${e.message})`
    );
  }
}

// Case 1: contentHash too short
await expectThrow(
  'contentHash too short',
  () => registerContent({ contentHash: 'abc123', generatingId: VALID_ID }),
  'contentHash must be exactly 64 lowercase hex characters'
);

// Case 2: contentHash uppercase (pattern requires lowercase only)
await expectThrow(
  'contentHash uppercase',
  () => registerContent({ contentHash: 'A'.repeat(64), generatingId: VALID_ID }),
  'contentHash must be exactly 64 lowercase hex characters'
);

// Case 3: contentHash non-hex characters
await expectThrow(
  'contentHash non-hex',
  () => registerContent({ contentHash: 'g'.repeat(64), generatingId: VALID_ID }),
  'contentHash must be exactly 64 lowercase hex characters'
);

// Case 4: contentHash correct length, correct charset — valid, should NOT throw on this check
// (kept separate from Cases 1-3 since a passing case proves the pattern isn't
// overly strict and rejecting legitimate input)
try {
  // NOTE: this will attempt a real Supabase insert unless credentials are
  // absent/invalid in this environment. If SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
  // are not configured for a disposable test table, this case will either
  // succeed (inserting a real row) or fail for network/credential reasons —
  // neither of which reflects the validation logic itself. Comment out the
  // live call below and only assert that no synchronous validation error is
  // thrown, if you don't want this test writing to a real table.
  await registerContent({ contentHash: VALID_HASH, generatingId: VALID_ID });
  console.log('PASS (valid contentHash — accepted, no validation error)');
} catch (e) {
  console.log(
    e.message.includes('contentHash') ? 'FAIL' : 'PASS',
    `(valid contentHash — ${e.message.includes('contentHash') ? 'incorrectly rejected' : 'validation passed, non-validation error: ' + e.message})`
  );
}

// Case 5: generatingId empty string
await expectThrow(
  'generatingId empty',
  () => registerContent({ contentHash: VALID_HASH, generatingId: '' }),
  'generatingId must be a printable ASCII string'
);

// Case 6: generatingId too long (>128 chars)
await expectThrow(
  'generatingId too long',
  () => registerContent({ contentHash: VALID_HASH, generatingId: 'x'.repeat(129) }),
  'generatingId must be a printable ASCII string'
);

// Case 7: generatingId non-printable character (e.g. newline)
await expectThrow(
  'generatingId non-printable char',
  () => registerContent({ contentHash: VALID_HASH, generatingId: 'test\nid' }),
  'generatingId must be a printable ASCII string'
);

// Case 8: generatingId wrong type (number instead of string)
await expectThrow(
  'generatingId wrong type',
  () => registerContent({ contentHash: VALID_HASH, generatingId: 12345 }),
  'generatingId must be a printable ASCII string'
);

console.log('--- End registry input validation tests ---');