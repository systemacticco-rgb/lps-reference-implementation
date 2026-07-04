import { extractManifest } from 'c2pa-text';
import { createVerify, createHash } from 'crypto';
import { decompress, decodeFromCBOR, canonicalBytes } from './compression.mjs';
import { queryRegistry } from './registryClient.mjs';

export async function verifyManifest(embeddedText) {

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
    const contentHash = createHash('sha256').update(embeddedText, 'utf8').digest('hex');
    const registryRecord = await queryRegistry({ contentHash });

    if (registryRecord) {
      return {
        status: 'registry_required',
        reason: 'No embedded signal found — provenance record exists in registry',
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
      reason: 'No embedded signal found in input text',
      anti_forensic_note: 'Absence of signal is itself forensic evidence of stripping or tampering'
    };
  }

  // STEP 2 — Decode bytes back to signed manifest object
  let signedManifest;
  try {
    const raw = decodeFromCBOR(extracted.manifest);
    signedManifest = decompress(raw);
  } catch {
    return {
      status: 'degraded',
      reason: 'Embedded signal found but could not be decoded — data is corrupted'
    };
  }


  // STEP 3 — Fetch certificate, verify fingerprint, verify signature
  let signatureValid;
  let certificate;
  try {
    const response = await fetch(signedManifest.cert_url);
    certificate = await response.text();

    const fetchedFingerprint = createHash('sha256').update(certificate, 'utf8').digest('hex');
    if (fetchedFingerprint !== signedManifest.cert_fingerprint) {
      return {
        status: 'failed',
        reason: 'Certificate fingerprint mismatch — fetched certificate does not match manifest record'
      };
    }

    const manifestBuffer = canonicalBytes(signedManifest.manifest);
    const verifier = createVerify('SHA256');
    verifier.update(manifestBuffer);
    verifier.end();
    signatureValid = verifier.verify(
      { key: certificate, dsaEncoding: 'ieee-p1363' },
      signedManifest.signature,
      'base64'
    );
  } catch {
    return {
      status: 'failed',
      reason: 'Certificate fetch or signature verification failed — check network or certificate URL'
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
    // Replay/transfer disclosure threshold (working-group-submission.md §5,
    // "Transfer/replay"; SPEC.md §9). original_manifest is only disclosed
    // when the received text's length is close enough to the signed
    // text's length to plausibly be a real edit of it — not a deliberate
    // large-mismatch replay attempt used to harvest manifest structure.
    // Threshold: 10% of signed text_length, either direction.
    const signedLength = signedManifest.manifest.text_length;
    const receivedLength = extracted.cleanText.length;
    const lengthDelta = Math.abs(receivedLength - signedLength);
    const withinThreshold = signedLength > 0
      ? (lengthDelta / signedLength) <= 0.10
      : lengthDelta === 0;

    if (!withinThreshold) {
      return {
        status: 'failed',
        reason: 'Visible text was modified after signing — content hash does not match. Original manifest withheld: received text length differs from signed text length beyond the disclosure threshold.',
        signed_at: signedManifest.signed_at ?? null,
        algorithm: signedManifest.algorithm ?? null
      };
    }

    return {
      status: 'failed',
      reason: 'Visible text was modified after signing — content hash does not match',
      signed_at: signedManifest.signed_at ?? null,
      algorithm: signedManifest.algorithm ?? null,
      original_manifest: {
        signed_at: signedManifest.signed_at ?? null,
        overall_ai_proportion: signedManifest.manifest.overall_ai_proportion ?? null,
        human_proportion: signedManifest.manifest.human_proportion ?? null,
        segments: signedManifest.manifest.content_segments.map(segment => ({
          segment_id: segment.segment_id,
          origin: segment.origin,
          confidence: segment.confidence,
          start_offset: segment.start_offset,
          end_offset: segment.end_offset,
          ai_tool: segment.ai_tool ?? null,
          modification_degree: segment.modification_degree ?? null
        }))
      }
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