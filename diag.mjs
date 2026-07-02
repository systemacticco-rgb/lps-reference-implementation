import { generateManifest } from './manifestGenerator.mjs';
import { signManifest } from './signingLayer.mjs';
import { embedManifest } from './embeddingLayer.mjs';
import { verifyManifest } from './verificationTool.mjs';
import { extractManifest } from 'c2pa-text';
import { createHash } from 'crypto';

const visibleText = "The quarterly figures show a 14% increase in retention.";
const segments = [{ segmentId:"s001", startOffset:0, endOffset:53, origin:"human", confidence:95 }];

const manifest = generateManifest({ visibleText, segments, signingTool:'lps-reference-implementation-v0.1', signedAt:new Date().toISOString() });
const embedded = embedManifest(visibleText, signManifest(manifest));
const extracted = extractManifest(embedded);

console.log('cleanText === original :', extracted.cleanText === visibleText);
console.log('original len / clean len:', visibleText.length, '/', extracted.cleanText.length);
console.log('manifest text_hash :', manifest.text_hash);
console.log('cleanText hash     :', createHash('sha256').update(extracted.cleanText,'utf8').digest('hex'));
console.log('in-memory verify   :', (await verifyManifest(embedded)).status);