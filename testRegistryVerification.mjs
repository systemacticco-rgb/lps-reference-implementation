import { registerContent } from './registryClient.mjs';
import { verifyManifest } from './verificationTool.mjs';

const plainText = 'This text has no embedded signal but is registered in the registry.';

console.log('--- SETUP: Register content hash ---');
const { createHash } = await import('crypto');
const contentHash = createHash('sha256').update(plainText, 'utf8').digest('hex');
const record = await registerContent({ contentHash, generatingId: 'test-generator-v0.1' });
console.log('Registered with token:', record.token);

console.log('\n--- TEST 1: registry_required state ---');
const result = await verifyManifest(plainText);
console.log('Result:', JSON.stringify(result, null, 2));

console.log('\n--- TEST 2: degraded state — unregistered text ---');
const unregistered = 'This text has no signal and is not in the registry.';
const degraded = await verifyManifest(unregistered);
console.log('Result:', JSON.stringify(degraded, null, 2));