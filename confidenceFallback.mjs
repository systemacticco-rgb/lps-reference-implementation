// confidenceFallback.mjs
// Calculates fallback confidence values from segment character distribution.
// Called by generateManifest() when a segment arrives with no confidence value.
// Never called directly in production — generateManifest() is the entry point.

export function calculateFallbackConfidence(segments) {
  let totalChars = 0;
  const originCounts = {
    human: 0,
    ai_generated: 0,
    ai_modified_human: 0
  };

  for (const seg of segments) {
    const charCount = seg.endOffset - seg.startOffset + 1;
    totalChars += charCount;

    if (originCounts[seg.origin] !== undefined) {
      originCounts[seg.origin] += charCount;
    }
  }

  // Guard against empty input — returns 0 for all origins if no characters found
  if (totalChars === 0) {
    return { human: 0, ai_generated: 0, ai_modified_human: 0 };
  }

  // floor() keeps the result conservative — never rounds up a weak signal
  return {
    human:             Math.floor((originCounts.human / totalChars) * 100),
    ai_generated:      Math.floor((originCounts.ai_generated / totalChars) * 100),
    ai_modified_human: Math.floor((originCounts.ai_modified_human / totalChars) * 100)
  };
}