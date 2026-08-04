import assert from 'node:assert/strict';
import { calculateFallbackConfidence } from '../main-pipeline/confidenceFallback.mjs';

const segments = [
  { segmentId: 's001', startOffset: 0,   endOffset: 20,  origin: 'ai_generated' },
  { segmentId: 's002', startOffset: 21,  endOffset: 30,  origin: 'human' },
  { segmentId: 's003', startOffset: 31,  endOffset: 90,  origin: 'ai_generated' },
  { segmentId: 's004', startOffset: 91,  endOffset: 120, origin: 'ai_modified_human' },
  { segmentId: 's005', startOffset: 121, endOffset: 200, origin: 'ai_generated' },
  { segmentId: 's006', startOffset: 201, endOffset: 250, origin: 'ai_modified_human' },
  { segmentId: 's007', startOffset: 251, endOffset: 500, origin: 'ai_generated' }
];

const result = calculateFallbackConfidence(segments);
assert.deepEqual(result, {
  ai_generated: 82,
  ai_modified_human: 15,
  human: 1
});

const empty = calculateFallbackConfidence([]);
assert.deepEqual(empty, {
  human: 0,
  ai_generated: 0,
  ai_modified_human: 0
});

console.log('PASS: fallback confidence assertions passed');
