import 'dotenv/config';
import { readFileSync } from 'fs';
import { createSign, createVerify, createHash } from 'crypto';
import { canonicalBytes } from './compression.mjs';

export function signManifest(manifest) {
  // [Y.1] SIGNING_ENABLED killswitch — checked first, before any key
  // access, per SPEC.md §3. Operational off switch: flipping this env
  // var stops all signing without touching, rotating, or deleting
  // private.pem. Does not protect the key itself — only gates this
  // code path.
  if (process.env.SIGNING_ENABLED !== 'true') {
    throw new Error('Signing disabled: SIGNING_ENABLED is not set to true');
  }

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
    const manifestBuffer = canonicalBytes(manifest);

    const signer = createSign('SHA256');
    signer.update(manifestBuffer);
    signer.end();

    const signature = signer.sign(
      { key: privateKey, dsaEncoding: 'ieee-p1363' },
      'base64'
    );

    const certFingerprint = createHash('sha256').update(certificate, 'utf8').digest('hex');
    
    console.log('Signer fingerprint:', certFingerprint);
    
    return {
      manifest,
      signature,
      cert_url: 'file://' + process.cwd() + '/cert.pem',
      cert_fingerprint: certFingerprint,
      algorithm: 'es256',
      signed_at: new Date().toISOString()
    };
  } catch (err) {
    throw new Error('Failed to sign manifest: ' + err.message);
  }
}