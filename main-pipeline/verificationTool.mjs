import {
  encodeWrapper,
  extractManifest
} from 'c2pa-text';
import { createVerify, createHash, X509Certificate } from 'crypto';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  decompress,
  decodeFromCBOR,
  canonicalBytes,
  findDuplicateTopLevelTextMapKey
} from './compression.mjs';
import { CURRENT_ENVELOPE_VERSION, authenticatedEnvelopeForSignature } from './signingLayer.mjs';

const ALLOWED_CERT_HOSTS = [
  'raw.githubusercontent.com', // production: systemacticco-rgb/lps-certificates
  // demo cert host added here once NEW-1's demo cert repo exists
];

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const CORRUPTED_CARRIER_FRAGMENT = /^\uFEFF(?:[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}])*/u;
const CARRIER_MAGIC_PREFIX = Array.from(encodeWrapper(new Uint8Array())).slice(0, 10).join('');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRequiredTimestamp(value) {
  return typeof value === 'string' && value.length > 0;
}

function textBindingFor(visibleText) {
  const cleanText = visibleText.replace(/[\r\n ]+$/, '');
  const bytes = Buffer.from(cleanText, 'utf8');
  return {
    cleanText,
    textHash: createHash('sha256').update(bytes).digest('hex'),
    textLength: bytes.length
  };
}

function unsupportedVersionResult(reason_code, reason) {
  return {
    status: 'unsupported_version',
    reason_code,
    carrier_condition: 'present',
    reason
  };
}

function versionFailure(ev) {
  if (ev === undefined) {
    return unsupportedVersionResult('missing_ev', 'Envelope version is required');
  }
  if (!Number.isInteger(ev)) {
    return unsupportedVersionResult('invalid_ev', 'Envelope version must be an integer');
  }
  if (ev !== CURRENT_ENVELOPE_VERSION) {
    return unsupportedVersionResult('unsupported_ev', 'Envelope version is not supported');
  }
  return null;
}

function invalidEnvelopeResult(reason_code, reason) {
  return {
    status: 'invalid_envelope',
    reason_code,
    carrier_condition: 'present',
    reason
  };
}

function validateDecodedEnvelope(signedManifest) {
  if (!isPlainObject(signedManifest) || !isPlainObject(signedManifest.manifest)) {
    return invalidEnvelopeResult('malformed_envelope', 'Decoded carrier does not contain an LPS envelope');
  }

  if (typeof signedManifest.signature !== 'string' || signedManifest.signature.length === 0 ||
      typeof signedManifest.cert_url !== 'string' || signedManifest.cert_url.length === 0 ||
      typeof signedManifest.cert_fingerprint !== 'string' || !SHA256_HEX_PATTERN.test(signedManifest.cert_fingerprint) ||
      typeof signedManifest.algorithm !== 'string' || signedManifest.algorithm.length === 0 ||
      !isRequiredTimestamp(signedManifest.signed_at)) {
    return invalidEnvelopeResult('invalid_schema', 'Envelope has invalid required fields');
  }

  const manifest = signedManifest.manifest;
  if (!isRequiredTimestamp(manifest.content_signed_at) ||
      Object.prototype.hasOwnProperty.call(manifest, 'signed_at') ||
      typeof manifest.text_hash !== 'string' || !SHA256_HEX_PATTERN.test(manifest.text_hash) ||
      !Number.isInteger(manifest.text_length) || manifest.text_length < 0 ||
      !Array.isArray(manifest.content_segments)) {
    return invalidEnvelopeResult('invalid_schema', 'Manifest has invalid required fields');
  }

  for (const segment of manifest.content_segments) {
    if (!isPlainObject(segment) ||
        (segment.confidence_source !== 'tool' && segment.confidence_source !== 'fallback') ||
        typeof segment.confidence !== 'number' || !Number.isFinite(segment.confidence) ||
        segment.confidence < 0 || segment.confidence > 100) {
      return invalidEnvelopeResult('invalid_schema', 'Manifest contains an invalid confidence value or confidence source');
    }
  }

  return null;
}

function extractedCarrier(embeddedText) {
  try {
    const extracted = extractManifest(embeddedText);
    if (extracted?.manifest) {
      return {
        carrier_condition: 'present',
        extracted: {
          ...extracted,
          embeddingMethodUsed: 'A.8'
        }
      };
    }
  } catch {
    // The recovery result below records the observable carrier condition.
  }

  const carrierStart = embeddedText.indexOf(CARRIER_MAGIC_PREFIX);
  const carrier_condition = carrierStart === -1 ? 'absent' : 'corrupted';
  const cleanText = carrier_condition === 'corrupted'
    ? embeddedText.slice(0, carrierStart) + embeddedText.slice(carrierStart).replace(CORRUPTED_CARRIER_FRAGMENT, '')
    : embeddedText;
  return {
    carrier_condition,
    cleanText
  };
}

async function recoverFromRegistry(cleanText, carrier_condition, options) {
  if (options.skipRegistry === true) {
    return {
      status: 'degraded',
      reason_code: 'registry_no_match',
      carrier_condition,
      reason: 'No exact registry match was established because registry lookup was skipped'
    };
  }

  const { textHash } = textBindingFor(cleanText);
  let registryRecord;
  try {
    const { queryRegistry } = await import('./registryClient.mjs');
    registryRecord = await queryRegistry({ contentHash: textHash });
  } catch (error) {
    if (error?.code === 'registry_unavailable' || error?.code === 'registry_response_invalid') {
      return {
        status: 'degraded',
        reason_code: error.code,
        carrier_condition,
        reason: error.code === 'registry_unavailable'
          ? 'Registry lookup could not be completed'
          : 'Registry lookup returned an invalid response'
      };
    }
    throw error;
  }

  if (registryRecord?.content_hash === textHash) {
    return {
      status: 'registry_required',
      reason_code: 'registry_match',
      carrier_condition,
      reason: 'An exact visible-text hash matches a registry record',
      registry_record: {
        token: registryRecord.token,
        content_hash: registryRecord.content_hash,
        generating_id: registryRecord.generating_id,
        created_at: registryRecord.created_at
      }
    };
  }

  return {
    status: 'degraded',
    reason_code: 'registry_no_match',
    carrier_condition,
    reason: 'No exact visible-text hash matches a registry record'
  };
}

function signatureFailure(reason, signedManifest, extracted) {
  return {
    status: 'failed',
    reason_code: 'signature_invalid',
    carrier_condition: 'present',
    reason,
    signed_at: signedManifest.signed_at ?? null,
    algorithm: signedManifest.algorithm ?? null,
    embedding_method_used: extracted.embeddingMethodUsed
  };
}

function originalManifestForDisclosure(signedManifest) {
  return {
    signed_at: signedManifest.signed_at ?? null,
    overall_ai_proportion: signedManifest.manifest.overall_ai_proportion ?? null,
    human_proportion: signedManifest.manifest.human_proportion ?? null,
    segments: signedManifest.manifest.content_segments.map(segment => ({
      segment_id: segment.segment_id,
      origin: segment.origin,
      confidence: segment.confidence,
      confidence_source: segment.confidence_source,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      ai_tool: segment.ai_tool ?? null,
      modification_degree: segment.modification_degree ?? null
    }))
  };
}

function isAllowedCertUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && ALLOWED_CERT_HOSTS.includes(parsed.hostname);
}

function isAllowedLocalCertUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'file:') {
    return false;
  }

  try {
    return fileURLToPath(parsed) === `${process.cwd()}/cert.pem`;
  } catch {
    return false;
  }
}

export function evaluateDisclosureThreshold({ signedLength, receivedLength }) {
  if (signedLength === undefined || signedLength === null) {
    return { disclose: false, reason: 'missing_text_length' };
  }
  const lengthDelta = Math.abs(receivedLength - signedLength);
  const withinThreshold = signedLength > 0
    ? (lengthDelta / signedLength) <= 0.10
    : lengthDelta === 0;
  return { disclose: withinThreshold, reason: withinThreshold ? 'within_threshold' : 'exceeds_threshold' };
}

export async function verifyManifest(embeddedText, options = {}) {
  const carrier = extractedCarrier(embeddedText);
  if (carrier.carrier_condition !== 'present') {
    return recoverFromRegistry(carrier.cleanText, carrier.carrier_condition, options);
  }

  const { extracted } = carrier;
  if (findDuplicateTopLevelTextMapKey(extracted.manifest) !== null) {
    return invalidEnvelopeResult(
      'noncanonical_encoding',
      'Decoded carrier contains duplicate top-level envelope keys'
    );
  }

  let rawEnvelope;
  try {
    rawEnvelope = decodeFromCBOR(extracted.manifest);
  } catch {
    return recoverFromRegistry(extracted.cleanText, 'unparseable', options);
  }

  if (!isPlainObject(rawEnvelope)) {
    return recoverFromRegistry(extracted.cleanText, 'unparseable', options);
  }

  const invalidVersion = versionFailure(rawEnvelope.ev);
  if (invalidVersion) return invalidVersion;

  if (!isPlainObject(rawEnvelope.m)) {
    return recoverFromRegistry(extracted.cleanText, 'unparseable', options);
  }

  let signedManifest;
  try {
    signedManifest = decompress(rawEnvelope);
  } catch {
    return invalidEnvelopeResult('malformed_envelope', 'Decoded carrier cannot be expanded into an LPS envelope');
  }

  const invalidEnvelope = validateDecodedEnvelope(signedManifest);
  if (invalidEnvelope) return invalidEnvelope;

  let signatureValid;
  try {
    const certSource = await loadCertificateForVerification(signedManifest.cert_url, options);
    if (!certSource.allowed) {
      return signatureFailure(certSource.reason, signedManifest, extracted);
    }

    const certificate = certSource.certificate;
    const fetchedFingerprint = createHash('sha256').update(new X509Certificate(certificate).raw).digest('hex');
    if (fetchedFingerprint !== signedManifest.cert_fingerprint) {
      return signatureFailure('Certificate fingerprint mismatch — fetched certificate does not match manifest record', signedManifest, extracted);
    }

    const envelopeBuffer = canonicalBytes(authenticatedEnvelopeForSignature(signedManifest));
    const verifier = createVerify('SHA256');
    verifier.update(envelopeBuffer);
    verifier.end();
    signatureValid = verifier.verify(
      { key: certificate, dsaEncoding: 'ieee-p1363' },
      signedManifest.signature,
      'base64'
    );
  } catch {
    return signatureFailure('Certificate fetch or signature verification failed — check network or certificate URL', signedManifest, extracted);
  }

  if (!signatureValid) {
    return signatureFailure('Signature invalid — authenticated envelope could not be verified with the advertised certificate', signedManifest, extracted);
  }

  const textBinding = textBindingFor(extracted.cleanText);
  const hashMatches = textBinding.textHash === signedManifest.manifest.text_hash;
  const lengthMatches = textBinding.textLength === signedManifest.manifest.text_length;

  if (!hashMatches || !lengthMatches) {
    const reason_code = hashMatches ? 'text_length_mismatch' : 'text_hash_mismatch';
    const bindingReason = hashMatches
      ? 'Visible text byte length does not match the authenticated record'
      : 'Visible text hash does not match the authenticated record';
    const { disclose, reason: thresholdReason } = evaluateDisclosureThreshold({
      signedLength: signedManifest.manifest.text_length,
      receivedLength: textBinding.textLength
    });
    const result = {
      status: 'failed',
      reason_code,
      carrier_condition: 'present',
      reason: disclose
        ? bindingReason
        : `${bindingReason}. Original manifest withheld because the received byte length exceeds the disclosure threshold.`,
      signed_at: signedManifest.signed_at,
      algorithm: signedManifest.algorithm,
      embedding_method_used: extracted.embeddingMethodUsed,
      clean_text: textBinding.cleanText,
      disclosure_threshold_outcome: thresholdReason,
      signed_text_length: signedManifest.manifest.text_length,
      received_text_length: textBinding.textLength
    };

    if (disclose) {
      result.original_manifest = originalManifestForDisclosure(signedManifest);
    }
    return result;
  }

  return {
    status: 'verified',
    carrier_condition: 'present',
    signed_at: signedManifest.signed_at,
    algorithm: signedManifest.algorithm,
    embedding_method_used: extracted.embeddingMethodUsed,
    clean_text: textBinding.cleanText,
    disclosure_threshold_outcome: 'not_applicable',
    signed_text_length: signedManifest.manifest.text_length,
    received_text_length: textBinding.textLength,
    overall_ai_proportion: signedManifest.manifest.overall_ai_proportion,
    human_proportion: signedManifest.manifest.human_proportion,
    segments: signedManifest.manifest.content_segments.map(segment => ({
      segment_id: segment.segment_id,
      origin: segment.origin,
      confidence: segment.confidence,
      confidence_source: segment.confidence_source,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      ai_tool: segment.ai_tool ?? null,
      modification_degree: segment.modification_degree ?? null
    }))
  };
}

async function loadCertificateForVerification(certUrl, options) {
  if (isAllowedCertUrl(certUrl)) {
    const response = await fetch(certUrl);
    return {
      allowed: true,
      certificate: await response.text()
    };
  }

  if (options.allowLocalCert === true && isAllowedLocalCertUrl(certUrl)) {
    return {
      allowed: true,
      certificate: await readFile(new URL(certUrl), 'utf8')
    };
  }

  return {
    allowed: false,
    reason: options.allowLocalCert === true
      ? 'Certificate URL not permitted — must be an allowed HTTPS host or the local test cert.pem'
      : 'Certificate URL not permitted — must be https and match an allowed host'
  };
}
