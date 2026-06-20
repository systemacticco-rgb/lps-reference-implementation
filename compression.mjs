// ============================================================
// compression.mjs — Shortcode compression utility
// ============================================================
// Two functions: compress and decompress.
// compress: replaces full field names with shortcodes before embedding.
// decompress: expands shortcodes back to full field names after extraction.
// Dictionary defined in SPEC.md section 4.1 — immutable for v0.1.
// ============================================================
import pkg from 'cbor';
const { encode, decode } = pkg;

const FIELD_MAP = {
  lps_version: 'lv',
  text_hash: 'th',
  content_segments: 'cs',
  segment_id: 'sid',
  start_offset: 'so',
  end_offset: 'eo',
  origin: 'or',
  confidence: 'cf',
  ai_tool: 'ait',
  modification_degree: 'md',
  overall_ai_proportion: 'oaip',
  human_proportion: 'hp',
  signing_tool: 'st',
  signed_at: 'sa',
  manifest: 'm',
  signature: 'sig',
  cert_url: 'cu',
  cert_fingerprint: 'cfp',
  algorithm: 'alg'
};

const ORIGIN_MAP = {
  human: 'h',
  ai_generated: 'aig',
  ai_modified_human: 'aimh'
};

// Reverse dictionaries for decompression
const FIELD_MAP_REVERSE = Object.fromEntries(Object.entries(FIELD_MAP).map(([k, v]) => [v, k]));
const ORIGIN_MAP_REVERSE = Object.fromEntries(Object.entries(ORIGIN_MAP).map(([k, v]) => [v, k]));

export function compress(signedManifest) {
  // Compress the inner manifest fields
  const m = signedManifest.manifest;
  const compressedManifest = {
    [FIELD_MAP.lps_version]: m.lps_version,
    [FIELD_MAP.text_hash]: m.text_hash,
    [FIELD_MAP.content_segments]: m.content_segments.map(seg => {
      const entry = {
        [FIELD_MAP.segment_id]: seg.segment_id,
        [FIELD_MAP.start_offset]: seg.start_offset,
        [FIELD_MAP.end_offset]: seg.end_offset,
        [FIELD_MAP.origin]: ORIGIN_MAP[seg.origin] ?? seg.origin,
        [FIELD_MAP.confidence]: seg.confidence
      };
      if (seg.ai_tool) entry[FIELD_MAP.ai_tool] = seg.ai_tool;
      if (seg.modification_degree != null) entry[FIELD_MAP.modification_degree] = seg.modification_degree;
      return entry;
    }),
    [FIELD_MAP.overall_ai_proportion]: m.overall_ai_proportion,
    [FIELD_MAP.human_proportion]: m.human_proportion,
    [FIELD_MAP.signing_tool]: m.signing_tool,
    [FIELD_MAP.signed_at]: m.signed_at
  };

  // Compress the outer signed manifest fields
  return {
    [FIELD_MAP.manifest]: compressedManifest,
    [FIELD_MAP.signature]: signedManifest.signature,
    [FIELD_MAP.cert_url]: signedManifest.cert_url,
    [FIELD_MAP.cert_fingerprint]: signedManifest.cert_fingerprint,
    [FIELD_MAP.algorithm]: signedManifest.algorithm,
    [FIELD_MAP.signed_at]: signedManifest.signed_at
  };
}

export function decompress(compressed) {
  // Decompress the inner manifest fields
  const m = compressed[FIELD_MAP.manifest];
  const decompressedManifest = {
    lps_version: m[FIELD_MAP.lps_version],
    text_hash: m[FIELD_MAP.text_hash],
    content_segments: m[FIELD_MAP.content_segments].map(seg => {
      const entry = {
        segment_id: seg[FIELD_MAP.segment_id],
        start_offset: seg[FIELD_MAP.start_offset],
        end_offset: seg[FIELD_MAP.end_offset],
        origin: ORIGIN_MAP_REVERSE[seg[FIELD_MAP.origin]] ?? seg[FIELD_MAP.origin],
        confidence: seg[FIELD_MAP.confidence]
      };
      if (seg[FIELD_MAP.ai_tool]) entry.ai_tool = seg[FIELD_MAP.ai_tool];
      if (seg[FIELD_MAP.modification_degree] != null) entry.modification_degree = seg[FIELD_MAP.modification_degree];
      return entry;
    }),
    overall_ai_proportion: m[FIELD_MAP.overall_ai_proportion],
    human_proportion: m[FIELD_MAP.human_proportion],
    signing_tool: m[FIELD_MAP.signing_tool],
    signed_at: m[FIELD_MAP.signed_at]
  };

  // Decompress the outer signed manifest fields
  return {
    manifest: decompressedManifest,
    signature: compressed[FIELD_MAP.signature],
    cert_url: compressed[FIELD_MAP.cert_url],
    cert_fingerprint: compressed[FIELD_MAP.cert_fingerprint],
    algorithm: compressed[FIELD_MAP.algorithm],
    signed_at: compressed[FIELD_MAP.signed_at]
  };
}

export function encodeToCBOR(compressed) {
  return encode(compressed);
}

export function decodeFromCBOR(buffer) {
  return decode(buffer);
}