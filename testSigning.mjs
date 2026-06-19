import { generateManifest } from './manifestGenerator.mjs';
import { signManifest } from './signingLayer.mjs';

const manifest = generateManifest({
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
  signedAt: new Date().toISOString()
});

try {
  const result = signManifest(manifest);
  console.log("--- Signing result type ---");
  console.log(typeof result);
  console.log("--- Signing result ---");
  console.log(result);
  console.log("--- PASS ---");
} catch (err) {
  console.log("--- FAIL ---");
  console.log(err.message);
}