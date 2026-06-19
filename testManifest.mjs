import { generateManifest } from './manifestGenerator.mjs';

const visibleText = 'A'.repeat(501);

const result = generateManifest({
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
    },
    {
      segmentId: "s003",
      startOffset: 401,
      endOffset: 500,
      origin: "ai_modified_human",
      aiTool: "claude-sonnet-4",
      modificationDegree: 0.3,
      confidence: 0.87
    }
  ],
  signingTool: "lps-reference-implementation-v0.1",
  signedAt: "2026-06-10T00:00:00Z"
});

console.log(JSON.stringify(result, null, 2));