import { registerContent, queryRegistry } from './registryClient.mjs';

const contentHash = 'abc123testhash';
const generatingId = 'test-generator-v0.1';

console.log('--- TEST 1: registerContent ---');
const record = await registerContent({ contentHash, generatingId });
console.log('Registered:', record);

console.log('\n--- TEST 2: queryRegistry by token ---');
const byToken = await queryRegistry({ token: record.token });
console.log('Found by token:', byToken);

console.log('\n--- TEST 3: queryRegistry by contentHash ---');
const byHash = await queryRegistry({ contentHash });
console.log('Found by hash:', byHash);

console.log('\n--- TEST 4: queryRegistry with unknown token ---');
const notFound = await queryRegistry({ token: 'lps_doesnotexist' });
console.log('Not found result:', notFound);

console.log('\n--- TEST 5: queryRegistry with no arguments ---');
try {
  await queryRegistry({});
} catch (err) {
  console.log('Caught expected error:', err.message);
}