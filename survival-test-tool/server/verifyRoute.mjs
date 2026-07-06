import { createHash, createVerify, timingSafeEqual } from 'crypto';
import { BEGIN_DELIMITER, END_DELIMITER, extractManifest, extractStructured } from 'c2pa-text';
import { canonicalBytes, compress, decompress, decodeFromCBOR } from '../../compression.mjs';
import { evaluateDisclosureThreshold } from '../../verificationTool.mjs';
import { validateCertUrl } from './certAllowlist.mjs';
import { DEMO_CERT_URL, loadDemoCertificate } from './demoKeyLoader.mjs';
import { formatVerificationReport } from './reportFormatter.mjs';

export const MAX_VERIFY_TEXT_LENGTH = 40_000;
export const MAX_VERIFY_BODY_BYTES = 192_000;
export const MAX_EMBEDDED_MANIFEST_BYTES = 65_536;
export const MAX_CERTIFICATE_BYTES = 65_536;

export async function handleVerifyRoute(req, res) {
  if (!enforceJsonPost(req, res)) {
    return;
  }

  try {
    const body = await readJsonBody(req, MAX_VERIFY_BODY_BYTES);
    const embeddedText = validateText(body.text);
    const rawResult = await verifyEmbeddedText(embeddedText);

    sendJson(res, 200, formatVerificationReport(rawResult));
  } catch (err) {
    console.error('survival-test verify failure', err);
    sendJson(res, errorStatusFor(err), { error: 'Unable to verify text' });
  }
}

async function verifyEmbeddedText(embeddedText) {
  const extracted = extractEmbeddedManifest(embeddedText);

  if (!extracted) {
    return degradedResult('no_embedded_signal');
  }

  if (extracted.manifest.length > MAX_EMBEDDED_MANIFEST_BYTES) {
    return degradedResult('embedded_manifest_too_large', extracted.embeddingMethodUsed);
  }

  const signedManifest = decodeSignedManifest(extracted.manifest);
  if (!signedManifest) {
    return degradedResult('embedded_manifest_decode_failed', extracted.embeddingMethodUsed);
  }

  const baseFields = {
    embedding_method_used: extracted.embeddingMethodUsed,
    algorithm: signedManifest.algorithm ?? null,
    signed_at: signedManifest.signed_at ?? null,
    compressed_manifest_byte_sizes: calculateCompressedManifestByteSizes(signedManifest, extracted.manifest.length),
    cert_fingerprint: signedManifest.cert_fingerprint ?? null,
    cert_url: signedManifest.cert_url ?? null,
  };

  const certValidation = validateCertUrl(signedManifest.cert_url);
  if (!certValidation.allowed) {
    return {
      ...baseFields,
      status: 'failed',
      reason_string: 'cert_url_not_allowed',
      disclosure_threshold_outcome: 'not_evaluated',
    };
  }

  const certificate = await loadCertificateForManifest(signedManifest.cert_url);
  if (!certificate) {
    return {
      ...baseFields,
      status: 'failed',
      reason_string: 'certificate_unavailable',
      disclosure_threshold_outcome: 'not_evaluated',
    };
  }

  const fetchedFingerprint = createHash('sha256').update(certificate, 'utf8').digest('hex');
  if (!timingSafeEqualHex(fetchedFingerprint, signedManifest.cert_fingerprint)) {
    return {
      ...baseFields,
      status: 'failed',
      reason_string: 'certificate_fingerprint_mismatch',
      disclosure_threshold_outcome: 'not_evaluated',
    };
  }

  if (!verifySignature(signedManifest, certificate)) {
    return {
      ...baseFields,
      status: 'failed',
      reason_string: 'signature_invalid',
      disclosure_threshold_outcome: 'not_evaluated',
    };
  }

  const receivedHash = createHash('sha256').update(extracted.cleanText, 'utf8').digest('hex');
  if (!timingSafeEqualHex(receivedHash, signedManifest.manifest.text_hash)) {
    return failedHashResult({
      signedManifest,
      receivedLength: extracted.cleanText.length,
      baseFields,
    });
  }

  return {
    ...baseFields,
    status: 'verified',
    reason_string: 'signature_intact_manifest_survived_round_trip',
    disclosure_threshold_outcome: 'not_applicable',
    segments: mapSegments(signedManifest.manifest.content_segments),
  };
}

function extractEmbeddedManifest(embeddedText) {
  try {
    const extracted = extractManifest(embeddedText);
    if (extracted?.manifest) {
      return {
        manifest: extracted.manifest,
        cleanText: extracted.cleanText,
        embeddingMethodUsed: 'A.8',
      };
    }
  } catch {
    return null;
  }

  try {
    const extracted = extractStructured(embeddedText);
    if (!extracted.manifest) {
      return null;
    }

    return {
      manifest: extracted.manifest,
      cleanText: removeStructuredManifestBlock(embeddedText),
      embeddingMethodUsed: 'A.9',
    };
  } catch {
    return null;
  }
}

function decodeSignedManifest(manifestBytes) {
  try {
    const decoded = decodeFromCBOR(Buffer.from(manifestBytes));
    return decompress(decoded);
  } catch {
    return null;
  }
}

async function loadCertificateForManifest(certUrl) {
  try {
    if (!validateCertUrl(certUrl).allowed) {
      return null;
    }

    if (certUrl === DEMO_CERT_URL) {
      return loadDemoCertificate();
    }

    return fetchCertificate(certUrl);
  } catch {
    return null;
  }
}

async function fetchCertificate(certUrl) {
  const response = await fetch(certUrl, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok || !response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.length;
    if (totalBytes > MAX_CERTIFICATE_BYTES) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function verifySignature(signedManifest, certificate) {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(canonicalBytes(signedManifest.manifest));
    verifier.end();

    return verifier.verify(
      { key: certificate, dsaEncoding: 'ieee-p1363' },
      signedManifest.signature,
      'base64'
    );
  } catch {
    return false;
  }
}

function failedHashResult({ signedManifest, receivedLength, baseFields }) {
  const threshold = evaluateDisclosureThreshold({
    signedLength: signedManifest.manifest.text_length,
    receivedLength,
  });
  const result = {
    ...baseFields,
    status: 'failed',
    reason_string: threshold.reason === 'missing_text_length'
      ? 'manifest_missing_text_length'
      : 'visible_text_hash_mismatch',
    disclosure_threshold_outcome: threshold.reason,
  };

  if (threshold.disclose) {
    result.segments = mapSegments(signedManifest.manifest.content_segments);
  }

  return result;
}

function calculateCompressedManifestByteSizes(signedManifest, cborByteLength) {
  const compressed = compress(signedManifest);

  return {
    raw_json: Buffer.byteLength(JSON.stringify(signedManifest), 'utf8'),
    shortcode_compressed: Buffer.byteLength(JSON.stringify(compressed), 'utf8'),
    cbor_encoded: cborByteLength,
  };
}

function removeStructuredManifestBlock(embeddedText) {
  const beginIndex = embeddedText.indexOf(BEGIN_DELIMITER);
  const endIndex = embeddedText.indexOf(END_DELIMITER);

  if (beginIndex < 0 || endIndex < beginIndex) {
    throw new Error('structured manifest block not found');
  }

  const lineStart = embeddedText.lastIndexOf('\n', beginIndex);
  const removalStart = lineStart < 0 ? 0 : lineStart;
  const blockEnd = endIndex + END_DELIMITER.length;
  const lineEnd = embeddedText.indexOf('\n', blockEnd);
  const removalEnd = lineEnd < 0 ? embeddedText.length : lineEnd;

  return (embeddedText.slice(0, removalStart) + embeddedText.slice(removalEnd)).normalize('NFC');
}

function mapSegments(segments = []) {
  return segments.map((segment) => {
    const mapped = {
      segment_id: segment.segment_id,
      origin: segment.origin,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      confidence: segment.confidence,
      confidence_source: segment.confidence_source ?? null,
      ai_tool: segment.ai_tool ?? null,
    };

    if (segment.origin === 'ai_modified_human') {
      mapped.modification_degree = segment.modification_degree ?? null;
    }

    return mapped;
  });
}

function timingSafeEqualHex(leftHex, rightHex) {
  try {
    const left = Buffer.from(String(leftHex), 'hex');
    const right = Buffer.from(String(rightHex), 'hex');

    if (left.length !== right.length || left.length === 0) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function degradedResult(reasonString, embeddingMethodUsed = null) {
  return {
    status: 'degraded',
    reason_string: reasonString,
    embedding_method_used: embeddingMethodUsed,
    algorithm: null,
    signed_at: null,
    compressed_manifest_byte_sizes: null,
    disclosure_threshold_outcome: 'not_evaluated',
    cert_fingerprint: null,
    cert_url: null,
    segments: [],
  };
}

function validateText(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_VERIFY_TEXT_LENGTH) {
    throw new ClientInputError();
  }

  return text;
}

async function readJsonBody(req, maxBytes) {
  let size = 0;
  let body = '';

  for await (const chunk of req) {
    size += chunk.length;

    if (size > maxBytes) {
      throw new PayloadTooLargeError();
    }

    body += chunk.toString('utf8');
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new ClientInputError();
  }
}

function enforceJsonPost(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return false;
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    sendJson(res, 415, { error: 'Unsupported content type' });
    return false;
  }

  return true;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function errorStatusFor(err) {
  if (err instanceof PayloadTooLargeError) {
    return 413;
  }

  if (err instanceof ClientInputError) {
    return 400;
  }

  return 500;
}

class ClientInputError extends Error {}
class PayloadTooLargeError extends Error {}
