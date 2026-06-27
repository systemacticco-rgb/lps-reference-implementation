import { calculateFallbackConfidence } from './confidenceFallback.mjs';

const segments = [
  { segmentId: 's001', startOffset: 0,   endOffset: 20,  origin: 'ai_generated' },
  { segmentId: 's002', startOffset: 21,  endOffset: 30,  origin: 'human' },
  { segmentId: 's003', startOffset: 31,  endOffset: 90,  origin: 'ai_generated' },
  { segmentId: 's004', startOffset: 91,  endOffset: 120, origin: 'ai_modified_human' },
  { segmentId: 's005', startOffset: 121, endOffset: 200, origin: 'ai_generated' },
  { segmentId: 's006', startOffset: 201, endOffset: 250, origin: 'ai_modified_human' },
  { segmentId: 's007', startOffset: 251, endOffset: 500, origin: 'ai_generated' }
];

console.log('--- TEST 1: correct integers returned per origin type ---');
const result = calculateFallbackConfidence(segments);
console.log('ai_generated:',      result.ai_generated,      '— expected 81');
console.log('ai_modified_human:', result.ai_modified_human, '— expected 16');
console.log('human:',             result.human,             '— expected 2');

console.log('\n--- TEST 2: zero guard ---');
const empty = calculateFallbackConfidence([]);
console.log('human:',             empty.human,             '— expected 0');
console.log('ai_generated:',      empty.ai_generated,      '— expected 0');
console.log('ai_modified_human:', empty.ai_modified_human, '— expected 0');