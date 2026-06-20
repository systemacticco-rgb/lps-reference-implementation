import { embedManifest } from './embeddingLayer.mjs';
import { signManifest } from './signingLayer.mjs';
import { generateManifest } from './manifestGenerator.mjs';
import { verifyManifest } from './verificationTool.mjs';

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
console.log('--- Verification result ---');
const result = await verifyManifest(embeddedText);
console.log(JSON.stringify(result, null, 2));

console.log('--- Adversarial test: tampered text ---');
const tamperedText = embeddedText + " TAMPERED";
const tamperedResult = await verifyManifest(tamperedText);
console.log(JSON.stringify(tamperedResult, null, 2));
})();