import { createHash } from 'crypto';

export function generateManifest({ visibleText, segments, signingTool, signedAt }) {
  const content_segments = segments.map((segment) => {
    const entry = {
      segment_id: segment.segmentId,
      start_offset: segment.startOffset,
      end_offset: segment.endOffset,
      origin: segment.origin,
      confidence: segment.confidence,
    };

    if (segment.origin === "ai_generated" || segment.origin === "ai_modified_human") {
      entry.ai_tool = segment.aiTool;
    }

    if (segment.origin === "ai_modified_human") {
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

  const textHash = createHash('sha256').update(visibleText, 'utf8').digest('hex');

  return {
    lps_version: "0.1",
    text_hash: textHash,
    content_segments,
    overall_ai_proportion,
    human_proportion,
    signing_tool: signingTool,
    signed_at: signedAt,
  };
}
