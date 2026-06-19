import { extractManifest } from 'c2pa-text';
import { createVerify, createHash } from 'crypto';

export function verifyManifest(embeddedText) {

  // STEP 1 — Extract manifest bytes from embedded text
  let extracted;
  try {
    extracted = extractManifest(embeddedText);
  } catch {
    return {
      status: 'degraded',
      reason: 'Signal extraction failed — embedded data may be corrupted or absent',
      anti_forensic_note: 'Absence of signal is itself forensic evidence of stripping or tampering'
    };
  }

  if (!extracted || !extracted.manifest) {
    return {
      status: 'degraded',
      reason: 'No embedded signal found in input text',
      anti_forensic_note: 'Absence of signal is itself forensic evidence of stripping or tampering'
    };
  }

  // STEP 2 — Decode bytes back to signed manifest object
  let signedManifest;
  try {
    const decoded = new TextDecoder().decode(extracted.manifest);
    signedManifest = JSON.parse(decoded);
  } catch {
    return {
      status: 'degraded',
      reason: 'Embedded signal found but could not be decoded — data is corrupted'
    };
  }

  // STEP 3 — Verify signature against public certificate
  let signatureValid;
  try {
    const manifestBuffer = Buffer.from(JSON.stringify(signedManifest.manifest), 'utf8');
    const verifier = createVerify('SHA256');
    verifier.update(manifestBuffer);
    verifier.end();
    signatureValid = verifier.verify(signedManifest.certificate, signedManifest.signature, 'base64');
  } catch {
    return {
      status: 'failed',
      reason: 'Signature verification process threw an error — certificate or signature may be malformed'
    };
  }

  if (!signatureValid) {
    return {
      status: 'failed',
      reason: 'Signature invalid — manifest was modified after signing',
      signed_at: signedManifest.signed_at ?? null,
      algorithm: signedManifest.algorithm ?? null
    };
  }

  // STEP 4 — Verify visible text hash
  // Hash the received text and compare against the hash stored
  // in the manifest at signing time. If they differ, the visible
  // text was changed after signing even though the manifest was not. 
  const receivedHash = createHash('sha256').update(extracted.cleanText, 'utf8').digest('hex');

  if (receivedHash !== signedManifest.manifest.text_hash) {
    return {
      status: 'failed',
      reason: 'Visible text was modified after signing — content hash does not match',
      signed_at: signedManifest.signed_at ?? null,
      algorithm: signedManifest.algorithm ?? null
    };
  }

  // STEP 5 — All checks passed — return full breakdown
  return {
    status: 'verified',
    signed_at: signedManifest.signed_at,
    algorithm: signedManifest.algorithm,
    overall_ai_proportion: signedManifest.manifest.overall_ai_proportion,
    human_proportion: signedManifest.manifest.human_proportion,
    segments: signedManifest.manifest.content_segments.map(segment => ({
      segment_id: segment.segment_id,
      origin: segment.origin,
      confidence: segment.confidence,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      ai_tool: segment.ai_tool ?? null,
      modification_degree: segment.modification_degree ?? null
    }))
  };
}