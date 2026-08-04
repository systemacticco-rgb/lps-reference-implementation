// test/testDegraded.mjs
import { verifyManifest } from '../main-pipeline/verificationTool.mjs';

const result = await verifyManifest('This is plain text with no embedded signal.');
console.log(JSON.stringify(result, null, 2));
