import { createHash, createSign } from 'crypto';
import { embedManifest as embedUnstructured, embedStructured, encodeDataUri, Placement } from 'c2pa-text';
import { generateManifest } from '../../manifestGenerator.mjs';
import { canonicalBytes, compress, encodeToCBOR } from '../../compression.mjs';
import { DEMO_CERT_URL, loadDemoSigningMaterial } from './demoKeyLoader.mjs';

export const MAX_SIGN_TEXT_LENGTH = 20_000;
export const MAX_SIGN_BODY_BYTES = 96_000;

const DEMO_SIGNING_TOOL = 'lps-demo-tool-v0.1';
const A8_COMPRESSED_MANIFEST_CEILING_BYTES = 220;

export async function handleSignRoute(req, res) {
  if (!enforceJsonPost(req, res)) {
    return;
  }

  try {
    const body = await readJsonBody(req, MAX_SIGN_BODY_BYTES);
    const visibleText = validateText(body.text);
    const segments = normalizeSegments(body.segments, visibleText);
    const signedAt = new Date().toISOString();
    const manifest = generateManifest({
      visibleText,
      segments,
      signingTool: DEMO_SIGNING_TOOL,
      signedAt,
    });
    const signedManifest = await signWithDemoKey(manifest);
    const embedded = embedWithDiagnostics(visibleText, signedManifest);

    sendJson(res, 200, {
      signed_text: embedded.text,
      embedding_method_used: embedded.embeddingMethodUsed,
      compressed_manifest_byte_sizes: embedded.compressedManifestByteSizes,
    });
  } catch (err) {
    console.error('survival-test sign failure', err);
    sendJson(res, errorStatusFor(err), { error: 'Unable to sign text' });
  }
}

async function signWithDemoKey(manifest) {
  const { privateKey, certificate } = await loadDemoSigningMaterial();
  const manifestBuffer = canonicalBytes(manifest);
  const signer = createSign('SHA256');
  signer.update(manifestBuffer);
  signer.end();

  const signature = signer.sign(
    { key: privateKey, dsaEncoding: 'ieee-p1363' },
    'base64'
  );
  const certFingerprint = createHash('sha256').update(certificate, 'utf8').digest('hex');

  return {
    manifest,
    signature,
    cert_url: DEMO_CERT_URL,
    cert_fingerprint: certFingerprint,
    algorithm: 'es256',
    signed_at: new Date().toISOString(),
  };
}

function embedWithDiagnostics(visibleText, signedManifest) {
  const compressed = compress(signedManifest);
  const cborBytes = encodeToCBOR(compressed);
  const compressedManifestByteSizes = {
    raw_json: Buffer.byteLength(JSON.stringify(signedManifest), 'utf8'),
    shortcode_compressed: Buffer.byteLength(JSON.stringify(compressed), 'utf8'),
    cbor_encoded: cborBytes.length,
  };

  if (cborBytes.length <= A8_COMPRESSED_MANIFEST_CEILING_BYTES) {
    return {
      text: embedUnstructured(visibleText, cborBytes),
      embeddingMethodUsed: 'A.8',
      compressedManifestByteSizes,
    };
  }

  return {
    text: embedStructured(visibleText, encodeDataUri(cborBytes), '<!--', '-->', Placement.End).text,
    embeddingMethodUsed: 'A.9',
    compressedManifestByteSizes,
  };
}

function normalizeSegments(inputSegments, visibleText) {
  if (!Array.isArray(inputSegments) || inputSegments.length === 0) {
    return buildDemoSegments(visibleText);
  }

  return inputSegments.map((segment, index) => {
    const normalized = {
      segmentId: String(segment.segmentId ?? segment.segment_id ?? `seg-${index + 1}`),
      startOffset: Number(segment.startOffset ?? segment.start_offset),
      endOffset: Number(segment.endOffset ?? segment.end_offset),
      origin: String(segment.origin),
      confidence: segment.confidence,
      aiTool: segment.aiTool ?? segment.ai_tool,
      modificationDegree: segment.modificationDegree ?? segment.modification_degree,
    };

    validateSegment(normalized, visibleText.length);
    return normalized;
  });
}

function buildDemoSegments(visibleText) {
  const lastIndex = visibleText.length - 1;

  if (visibleText.length < 3) {
    return [{
      segmentId: 'seg-001',
      startOffset: 0,
      endOffset: lastIndex,
      origin: 'human',
      confidence: 0.95,
    }];
  }

  const firstEnd = Math.max(0, Math.floor(lastIndex * 0.42));
  const secondEnd = Math.max(firstEnd + 1, Math.floor(lastIndex * 0.72));

  return [
    {
      segmentId: 'seg-001',
      startOffset: 0,
      endOffset: firstEnd,
      origin: 'human',
      confidence: 0.95,
    },
    {
      segmentId: 'seg-002',
      startOffset: firstEnd + 1,
      endOffset: secondEnd,
      origin: 'ai_generated',
      aiTool: 'lps-demo-generator',
      confidence: 0.92,
    },
    {
      segmentId: 'seg-003',
      startOffset: secondEnd + 1,
      endOffset: lastIndex,
      origin: 'ai_modified_human',
      aiTool: 'lps-demo-editor',
      modificationDegree: 'moderate',
      confidence: 0.9,
    },
  ];
}

function validateSegment(segment, textLength) {
  const validOrigin = ['human', 'ai_generated', 'ai_modified_human'].includes(segment.origin);

  if (!Number.isInteger(segment.startOffset) || !Number.isInteger(segment.endOffset) || !validOrigin) {
    throw new ClientInputError();
  }

  if (segment.startOffset < 0 || segment.endOffset < segment.startOffset || segment.endOffset >= textLength) {
    throw new ClientInputError();
  }

  if ((segment.origin === 'ai_generated' || segment.origin === 'ai_modified_human') && !segment.aiTool) {
    throw new ClientInputError();
  }

  if (segment.origin === 'ai_modified_human' && !segment.modificationDegree) {
    throw new ClientInputError();
  }
}

function validateText(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_SIGN_TEXT_LENGTH) {
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
