export function formatVerificationReport(rawResult) {
  const segments = normalizeSegments(rawResult.segments ?? []);
  const proportions = calculateProportions(segments);

  return {
    status: rawResult.status,
    reason_string: rawResult.reason_string,
    headline: headlineFor(rawResult.status),
    explanation: explanationFor(rawResult.status),
    proportions,
    segments,
    embedding_method_used: rawResult.embedding_method_used ?? null,
    algorithm: rawResult.algorithm ?? null,
    signed_at: rawResult.signed_at ?? null,
    compressed_manifest_byte_sizes: rawResult.compressed_manifest_byte_sizes ?? null,
    disclosure_threshold_outcome: rawResult.disclosure_threshold_outcome ?? null,
    cert_fingerprint: rawResult.cert_fingerprint ?? null,
    cert_url: rawResult.cert_url ?? null,
  };
}

function headlineFor(status) {
  if (status === 'verified') {
    return "Verified - this text's provenance signature is intact";
  }

  if (status === 'failed') {
    return 'Not verified - provenance checks did not pass';
  }

  return 'Degraded - no trustworthy provenance signal could be verified';
}

function explanationFor(status) {
  if (status === 'verified') {
    return 'The pasted text still matches the embedded provenance manifest and its demo certificate.';
  }

  if (status === 'failed') {
    return 'The embedded provenance signal was found, but one or more integrity checks failed.';
  }

  return 'The pasted text did not contain a complete, decodable provenance signal for this demo verifier.';
}

function calculateProportions(segments) {
  const totals = {
    human: 0,
    ai_generated: 0,
    ai_modified_human: 0,
  };

  let totalLength = 0;

  for (const segment of segments) {
    const length = Math.max(0, Number(segment.end_offset) - Number(segment.start_offset) + 1);
    totalLength += length;

    if (Object.hasOwn(totals, segment.origin)) {
      totals[segment.origin] += length;
    }
  }

  if (totalLength === 0) {
    return {
      human: 0,
      ai_generated: 0,
      ai_modified_human: 0,
    };
  }

  return {
    human: Math.round((totals.human / totalLength) * 100),
    ai_generated: Math.round((totals.ai_generated / totalLength) * 100),
    ai_modified_human: Math.round((totals.ai_modified_human / totalLength) * 100),
  };
}

function normalizeSegments(segments) {
  return segments.map((segment) => {
    const normalized = {
      segment_id: segment.segment_id,
      origin: segment.origin,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      confidence: segment.confidence,
      confidence_source: segment.confidence_source ?? null,
      ai_tool: segment.ai_tool ?? null,
    };

    if (segment.origin === 'ai_modified_human') {
      normalized.modification_degree = segment.modification_degree ?? null;
    }

    return normalized;
  });
}
