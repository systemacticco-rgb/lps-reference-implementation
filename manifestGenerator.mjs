// ============================================================
// manifestGenerator.mjs 
// ============================================================
import { createHash } from 'crypto';
import { calculateFallbackConfidence } from './confidenceFallback.mjs';

export function generateManifest({
  visibleText,
  segments,
  signingTool,
  contentSignedAt
}) {
  if (!Array.isArray(segments)) {
    throw new Error('segments must be an array');
  }

  if (typeof contentSignedAt !== 'string' || contentSignedAt.length === 0) {
  throw new Error('contentSignedAt must be a non-empty timestamp string');
  }

  // Calculate fallback confidence map before mapping segments —
  // only used when a segment arrives with no confidence value
  const fallbackConfidence = calculateFallbackConfidence(segments);

  const content_segments = segments.map((segment) => {
    const hasConfidence = segment.confidence !== undefined;
    const hasConfidenceSource = Object.prototype.hasOwnProperty.call(segment, 'confidenceSource');

    if (segment.confidence === null || (hasConfidence && (typeof segment.confidence !== 'number' || !Number.isFinite(segment.confidence)))) {
      throw new Error(`Segment ${segment.segmentId}: confidence value must be a finite number`);
    }

    if (hasConfidenceSource && segment.confidenceSource !== (hasConfidence ? 'tool' : 'fallback')) {
      throw new Error(`Segment ${segment.segmentId}: confidenceSource contradicts the supplied confidence`);
    }

    // Normalize float to integer if tool supplied a float (e.g. 0.95 → 95)
    const rawConfidence = hasConfidence
      ? Math.round(segment.confidence <= 1 ? segment.confidence * 100 : segment.confidence)
      : null;

    if (hasConfidence && (rawConfidence < 0 || rawConfidence > 100)) {
      throw new Error(`Segment ${segment.segmentId}: confidence value out of range — must be 0–100`);
    }

    const confidenceValue = hasConfidence
      ? rawConfidence
      : fallbackConfidence[segment.origin];

    const confidenceSource = hasConfidence ? 'tool' : 'fallback';

    const entry = {
      segment_id:        segment.segmentId,
      start_offset:      segment.startOffset,
      end_offset:        segment.endOffset,
      origin:            segment.origin,
      confidence:        confidenceValue,
      confidence_source: confidenceSource
    };

    if (segment.origin === 'ai_generated' || segment.origin === 'ai_modified_human') {
      entry.ai_tool = segment.aiTool;
    }

    if (segment.origin === 'ai_modified_human') {
      if (segment.modificationDegree === undefined || segment.modificationDegree === null) {
        throw new Error(`Segment ${segment.segmentId}: modification_degree is required for ai_modified_human`);
      }
      entry.modification_degree = segment.modificationDegree;
    }

    return entry;
  });

  let aiCharCount = 0;
  let humanCharCount = 0;
  let totalCharCount = 0;

  for (const segment of segments) {
    const charCount = segment.endOffset - segment.startOffset + 1;
    totalCharCount += charCount;

    if (segment.origin === "ai_generated" || segment.origin === "ai_modified_human") {
      aiCharCount += charCount;
    } else if (segment.origin === "human") {
      humanCharCount += charCount;
    }
  }

  const overall_ai_proportion = totalCharCount === 0 ? 0 : Math.round((aiCharCount / totalCharCount) * 100) / 100;
  const human_proportion = totalCharCount === 0 ? 0 : Math.round((humanCharCount / totalCharCount) * 100) / 100;
  // Math.round(x * 100) / 100 keeps proportions to two decimal places. 0.4, not 0.39999999...

  const strippedText = visibleText.replace(/[\r\n ]+$/, '');
  const canonicalTextBytes = Buffer.from(strippedText, 'utf8');
  const textHash = createHash('sha256').update(canonicalTextBytes).digest('hex');

  return {
    lps_version: "0.1",
    text_hash: textHash,
    text_length: canonicalTextBytes.length,
    content_segments,
    overall_ai_proportion,
    human_proportion,
    signing_tool: signingTool,
    content_signed_at: contentSignedAt,
  };
}
