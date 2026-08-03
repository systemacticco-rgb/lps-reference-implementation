import 'dotenv/config';
import { readFileSync } from 'fs';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  X509Certificate
} from 'crypto';
import { canonicalBytes } from './compression.mjs';

export const CURRENT_ENVELOPE_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRequiredTimestamp(value) {
  return typeof value === 'string' && value.length > 0;
}

function assertManifestReadyForSigning(manifest) {
  if (!isPlainObject(manifest)) {
    throw new Error('Invalid manifest: manifest must be an object');
  }

  if (!isRequiredTimestamp(manifest.content_signed_at)) {
    throw new Error('Invalid manifest: content_signed_at must be a non-empty timestamp string');
  }

  if (Object.prototype.hasOwnProperty.call(manifest, 'signed_at')) {
    throw new Error('Invalid manifest: signed_at belongs to the LPS envelope, not the content record');
  }

  if (typeof manifest.text_hash !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.text_hash)) {
    throw new Error('Invalid manifest: text_hash must be a SHA-256 lowercase hex value');
  }

  if (!Number.isInteger(manifest.text_length) || manifest.text_length < 0) {
    throw new Error('Invalid manifest: text_length must be a non-negative integer');
  }

  if (!Array.isArray(manifest.content_segments)) {
    throw new Error('Invalid manifest: content_segments must be an array');
  }

  for (const segment of manifest.content_segments) {
    if (!isPlainObject(segment)) {
      throw new Error('Invalid manifest: each content segment must be an object');
    }

    if (segment.confidence_source !== 'tool' && segment.confidence_source !== 'fallback') {
      throw new Error('Invalid manifest: confidence_source must be tool or fallback');
    }

    if (typeof segment.confidence !== 'number' || !Number.isFinite(segment.confidence) || segment.confidence < 0 || segment.confidence > 100) {
      throw new Error('Invalid manifest: confidence must be a finite value from 0 to 100');
    }
  }
}

export function authenticatedEnvelopeForSignature({ ev, manifest, algorithm, signed_at }) {
  return { ev, manifest, algorithm, signed_at };
}

export function assertSigningMaterialMatches(privateKeyPem, certificatePem) {
  let publicFromPrivate;
  let publicFromCertificate;

  try {
    publicFromPrivate = createPublicKey(createPrivateKey(privateKeyPem))
      .export({ type: 'spki', format: 'pem' });
  } catch {
    throw new Error('Signing material invalid: private.pem could not be parsed as a private key');
  }

  try {
    publicFromCertificate = new X509Certificate(certificatePem)
      .publicKey
      .export({ type: 'spki', format: 'pem' });
  } catch {
    throw new Error('Signing material invalid: cert.pem could not be parsed as an X.509 certificate');
  }

  if (publicFromPrivate !== publicFromCertificate) {
    throw new Error('Signing material mismatch: private.pem does not match cert.pem');
  }
}

export function signManifest(manifest) {
  // [Y.1] SIGNING_ENABLED killswitch — checked first, before any key
  // access, per SPEC.md §3. Operational off switch: flipping this env
  // var stops all signing without touching, rotating, or deleting
  // private.pem. Does not protect the key itself — only gates this
  // code path.
  if (process.env.SIGNING_ENABLED !== 'true') {
    throw new Error('Signing disabled: SIGNING_ENABLED is not set to true');
  }

  assertManifestReadyForSigning(manifest);

  let privateKey;
  let certificate;

  try {
    privateKey = readFileSync('./private.pem', 'utf8');
  } catch {
    throw new Error('Failed to read private key file');
  }

  try {
    certificate = readFileSync('./cert.pem', 'utf8');
  } catch {
    throw new Error('Failed to read certificate file');
  }

  assertSigningMaterialMatches(privateKey, certificate);

  try {
    const signed_at = new Date().toISOString();
    const algorithm = 'es256';
    const authenticatedEnvelope = authenticatedEnvelopeForSignature({
      ev: CURRENT_ENVELOPE_VERSION,
      manifest,
      algorithm,
      signed_at
    });
    const manifestBuffer = canonicalBytes(authenticatedEnvelope);

    const signer = createSign('SHA256');
    signer.update(manifestBuffer);
    signer.end();

    const signature = signer.sign(
      { key: privateKey, dsaEncoding: 'ieee-p1363' },
      'base64'
    );

    const certFingerprint = createHash('sha256').update(new X509Certificate(certificate).raw).digest('hex');

    return {
      ev: CURRENT_ENVELOPE_VERSION,
      manifest,
      signature,
      cert_url: 'https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem',
      cert_fingerprint: certFingerprint,
      algorithm,
      signed_at
    };
  } catch (err) {
    throw new Error('Failed to sign manifest: ' + err.message);
  }
}
