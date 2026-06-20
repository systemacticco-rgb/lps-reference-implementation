import { readFileSync } from 'fs';
import { createSign, createVerify, createHash } from 'crypto';

export function signManifest(manifest) {
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

  try {
    const manifestString = JSON.stringify(manifest);
    const manifestBuffer = Buffer.from(manifestString, 'utf8');

    const signer = createSign('SHA256');
    signer.update(manifestBuffer);
    signer.end();

    const signature = signer.sign(privateKey, 'base64');

    const certFingerprint = createHash('sha256').update(certificate, 'utf8').digest('hex');

    return {
      manifest,
      signature,
      cert_url: 'https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem',
      cert_fingerprint: certFingerprint,
      algorithm: 'es256',
      signed_at: new Date().toISOString()
    };
  } catch (err) {
    throw new Error('Failed to sign manifest: ' + err.message);
  }
}