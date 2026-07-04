import { registerContent, queryRegistry } from './registryClient.mjs';

/*
 * [K.1] WHAT THIS FILE DOES
 * This test exercises registryClient.mjs in complete isolation —
 * no manifest, no signing, no embedding.
 * It tests the database layer directly: write a record, then read it
 * back three different ways, then confirm the two failure states
 * behave exactly as designed.
 * Five tests. Each one targets a specific behavior of the registry.
 * This is the only test that requires a live Supabase connection.
 * If the database is unreachable or the environment variables are missing,
 * every test here fails. That is expected and correct.
 */

const contentHash = 'abc123testhash';
const generatingId = 'test-generator-v0.1';
// Fixed values — not real hashes, not real IDs.
// The registry does not validate the format of these fields.
// It stores whatever it receives. Using fixed strings makes the
// output easy to read and verify in the terminal.

/*
 * [K.2] TEST 1 — registerContent()
 * Calls registerContent() with the fixed hash and generator ID.
 * The function generates a unique lps_ token, writes one row to
 * registry_records, and returns the full inserted record including
 * the database-assigned created_at timestamp.
 *
 * What to look for in the output:
 *   token       — starts with "lps_" followed by 32 hex characters.
 *   content_hash — "abc123testhash" exactly as passed in.
 *   generating_id — "test-generator-v0.1" exactly as passed in.
 *   created_at  — a real ISO timestamp from the database.
 *
 * This record is stored in the variable "record". Its token is used
 * in Test 2 to prove lookup by token works against the same row
 * that was just written.
 */

console.log('--- TEST 1: registerContent ---');
const record = await registerContent({ contentHash, generatingId });
console.log('Registered:', record);

/*
 * [K.3] TEST 2 — queryRegistry() by token
 * Uses the token returned from Test 1 to look up the same row.
 * This is the direct lookup path — the caller has the token,
 * queries with it, gets the record back.
 *
 * What to look for: the returned record must be identical to what
 * Test 1 printed. Same token, same hash, same generating_id, same timestamp.
 * A usage_events row is also written to the database during this call —
 * that is not visible in the terminal output but it happened.
 * query_type in that row will be "token".
 */

console.log('\n--- TEST 2: queryRegistry by token ---');
const byToken = await queryRegistry({ token: record.token });
console.log('Found by token:', byToken);

/*
 * [K.4] TEST 3 — queryRegistry() by contentHash
 * Uses the content hash to look up the same row — no token provided.
 * This is the path verificationTool.mjs uses when it finds no embedded signal:
 * hash the received text, query by hash, check if a record exists.
 *
 * What to look for: same record again. Identical to Tests 1 and 2.
 * Confirms that hash-based lookup works against the same database row.
 * usage_events will record query_type "content_hash" for this call.
 */

console.log('\n--- TEST 3: queryRegistry by contentHash ---');
const byHash = await queryRegistry({ contentHash });
console.log('Found by hash:', byHash);

/*
 * [K.5] TEST 4 — queryRegistry() with a token that does not exist
 * Passes a token that was never registered — "lps_doesnotexist".
 * The database query returns no rows. Error code PGRST116 is returned
 * by Supabase. registryClient.mjs catches that specific code and
 * returns null instead of throwing.
 *
 * What to look for: "Not found result: null"
 * null is the correct and expected output here — not an error, not a crash.
 * This is the signal verificationTool.mjs uses to decide between
 * registry_required and degraded. Null means: no record exists.
 * The degraded state is appropriate.
 */

console.log('\n--- TEST 4: queryRegistry with unknown token ---');
const notFound = await queryRegistry({ token: 'lps_doesnotexist' });
console.log('Not found result:', notFound);

/*
 * [K.6] TEST 5 — queryRegistry() with no arguments
 * Passes an empty object — no token, no contentHash.
 * registryClient.mjs has an explicit guard for this:
 * if neither field is provided, it throws immediately with a clear message
 * before any database query runs.
 *
 * What to look for: "Caught expected error: queryRegistry requires token or contentHash"
 * The try/catch here is intentional — this test is designed to throw.
 * The catch block prints the error message to confirm the guard works.
 * If it does not throw, something is wrong with the input validation.
 */

console.log('\n--- TEST 5: queryRegistry with no arguments ---');
try {
  await queryRegistry({});
} catch (err) {
  console.log('Caught expected error:', err.message);
}