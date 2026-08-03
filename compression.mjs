// ============================================================
// compression.mjs — Shortcode compression utility
// ============================================================
// Two functions: compress and decompress.
// compress: replaces full field names with shortcodes before embedding.
// decompress: expands shortcodes back to full field names after extraction.
// Dictionary defined in SPEC.md section 4.1 — immutable for v0.1.
// ============================================================
import pkg from 'cbor';
const { encode, decode, Decoder } = pkg;

const FIELD_MAP = {
  lps_version: 'lv',
  text_hash: 'th',
  text_length: 'tl',
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
  algorithm: 'alg',
  confidence_source: 'csrc',
};

const ORIGIN_MAP = {
  human: 'h',
  ai_generated: 'aig',
  ai_modified_human: 'aimh'
};

// Reverse dictionaries for decompression
const FIELD_MAP_REVERSE = Object.fromEntries(Object.entries(FIELD_MAP).map(([k, v]) => [v, k]));
const ORIGIN_MAP_REVERSE = Object.fromEntries(Object.entries(ORIGIN_MAP).map(([k, v]) => [v, k]));

const DEFAULT_LPS_VERSION = '0.1';
const DEFAULT_SIGNING_TOOL = 'lps-reference-implementation-v0.1';

export function compress(signedManifest) {
  // Compress the inner manifest fields
  const m = signedManifest.manifest;
  const compressedManifest = {
    [FIELD_MAP.text_hash]: m.text_hash,
    [FIELD_MAP.text_length]: m.text_length,
    [FIELD_MAP.content_segments]: m.content_segments.map(seg => {
      const entry = {
        [FIELD_MAP.segment_id]: seg.segment_id,
        [FIELD_MAP.start_offset]: seg.start_offset,
        [FIELD_MAP.end_offset]: seg.end_offset,
        [FIELD_MAP.origin]: ORIGIN_MAP[seg.origin] ?? seg.origin,
        [FIELD_MAP.confidence]: seg.confidence,
        [FIELD_MAP.confidence_source]: seg.confidence_source
      };
      if (seg.ai_tool) entry[FIELD_MAP.ai_tool] = seg.ai_tool;
      if (seg.modification_degree != null) entry[FIELD_MAP.modification_degree] = seg.modification_degree;
      return entry;
    }),
    [FIELD_MAP.overall_ai_proportion]: m.overall_ai_proportion,
    [FIELD_MAP.human_proportion]: m.human_proportion,
    content_signed_at: m.content_signed_at
  };

  // Default field assumption (README §3.2, SPEC §4.1) — lv and st
  // are only written when they differ from the v0.1 defaults.
  if (m.lps_version !== DEFAULT_LPS_VERSION) {
    compressedManifest[FIELD_MAP.lps_version] = m.lps_version;
  }
  if (m.signing_tool !== DEFAULT_SIGNING_TOOL) {
    compressedManifest[FIELD_MAP.signing_tool] = m.signing_tool;
  }

  // Compress the outer signed manifest fields
  return {
    ev: signedManifest.ev,
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
  const compressedSegments = m[FIELD_MAP.content_segments];
  const decompressedManifest = {
    lps_version: m[FIELD_MAP.lps_version] ?? DEFAULT_LPS_VERSION,
    text_hash: m[FIELD_MAP.text_hash],
    text_length: m[FIELD_MAP.text_length],
    content_segments: Array.isArray(compressedSegments) ? compressedSegments.map(seg => {
      if (seg === null || typeof seg !== 'object') return seg;
      const entry = {
        segment_id: seg[FIELD_MAP.segment_id],
        start_offset: seg[FIELD_MAP.start_offset],
        end_offset: seg[FIELD_MAP.end_offset],
        origin: ORIGIN_MAP_REVERSE[seg[FIELD_MAP.origin]] ?? seg[FIELD_MAP.origin],
        confidence: seg[FIELD_MAP.confidence],
        confidence_source: seg[FIELD_MAP.confidence_source]
      };
      if (seg[FIELD_MAP.ai_tool]) entry.ai_tool = seg[FIELD_MAP.ai_tool];
      if (seg[FIELD_MAP.modification_degree] != null) entry.modification_degree = seg[FIELD_MAP.modification_degree];
      return entry;
    }) : compressedSegments,
    overall_ai_proportion: m[FIELD_MAP.overall_ai_proportion],
    human_proportion: m[FIELD_MAP.human_proportion],
    signing_tool: m[FIELD_MAP.signing_tool] ?? DEFAULT_SIGNING_TOOL,
    content_signed_at: m.content_signed_at
  };

  // Decompress the outer signed manifest fields
  return {
    ev: compressed.ev,
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

function topLevelMapHeader(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0 || (bytes[0] >> 5) !== 5) return null;

  const additionalInfo = bytes[0] & 0x1f;
  if (additionalInfo <= 23) {
    return { bytes, pairCount: additionalInfo, offset: 1 };
  }
  if (additionalInfo === 31) {
    return { bytes, pairCount: null, offset: 1 };
  }

  const widths = { 24: 1, 25: 2, 26: 4, 27: 8 };
  const width = widths[additionalInfo];
  if (width === undefined || bytes.length < 1 + width) return null;

  let pairCount;
  if (width === 1) pairCount = bytes.readUInt8(1);
  else if (width === 2) pairCount = bytes.readUInt16BE(1);
  else if (width === 4) pairCount = bytes.readUInt32BE(1);
  else {
    const value = bytes.readBigUInt64BE(1);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    pairCount = Number(value);
  }

  return { bytes, pairCount, offset: 1 + width };
}

// The general decoder collapses duplicate object keys. The verifier needs a
// pre-decode check for the authenticated envelope's top-level text keys.
export function findDuplicateTopLevelTextMapKey(buffer) {
  try {
    const header = topLevelMapHeader(buffer);
    if (header === null) return null;

    const seen = new Set();
    let remaining = header.bytes.subarray(header.offset);
    let pairsRead = 0;

    while (header.pairCount === null || pairsRead < header.pairCount) {
      if (header.pairCount === null && remaining[0] === 0xff) break;

      const key = Decoder.decodeFirstSync(remaining, { extendedResults: true });
      if (typeof key.value === 'string') {
        if (seen.has(key.value)) return key.value;
        seen.add(key.value);
      }
      remaining = key.unused;

      const value = Decoder.decodeFirstSync(remaining, { extendedResults: true });
      remaining = value.unused;
      pairsRead += 1;
    }
  } catch {
    // Let the normal decoder preserve its established malformed-carrier path.
  }

  return null;
}

// Canonical CBOR bytes for signing/verification.
// Deterministic: identical bytes for logically-equal objects,
// independent of key insertion order. Both signingLayer and
// verificationTool MUST use this same function.
export function canonicalBytes(obj) {
  return pkg.encodeCanonical(obj);
}
