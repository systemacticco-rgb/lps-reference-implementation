// testDegraded.mjs
import { verifyManifest } from './verificationTool.mjs';

const result = await verifyManifest('This is plain text with no embedded signal.');
console.log(JSON.stringify(result, null, 2));