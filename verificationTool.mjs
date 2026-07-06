import { extractManifest } from 'c2pa-text';
import { createVerify, createHash } from 'crypto';
import { decompress, decodeFromCBOR, canonicalBytes } from './compression.mjs';
import { queryRegistry } from './registryClient.mjs';

// ============================================================
// evaluateDisclosureThreshold — pure function, no side effects
// ============================================================
// Extracted from verifyManifest STEP 4 so it can be unit-tested
// directly without going through signing/embedding/extraction.
// Decides whether original_manifest should be disclosed in the
// failed state, based on the D.6 length-mismatch threshold
// (SPEC.md §9, working-group-submission.md §5 "Transfer/replay").
//
// Three outcomes:
//   missing_text_length — signedLength is undefined/null. Manifest
//     predates the text_length schema field (D.6). Cannot evaluate
//     the threshold at all — caller must treat this as failed,
//     no disclosure, distinct reason string.
//   within_threshold     — delta is within 10% of signedLength
//     (or exact match when signedLength is 0). original_manifest
//     may be disclosed.
//   exceeds_threshold     — delta exceeds 10%. original_manifest
//     must be withheld.

// Add near the top of verificationTool.mjs
const ALLOWED_CERT_HOSTS = [
  'raw.githubusercontent.com', // production: systemacticco-rgb/lps-certificates
  // demo cert host added here once NEW-1's demo cert repo exists
];

function isAllowedCertUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && ALLOWED_CERT_HOSTS.includes(parsed.hostname);
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
     if (!isAllowedCertUrl(signedManifest.cert_url)) {
      return {
        status: 'failed',
        reason: 'Certificate URL not permitted — must be https and match an allowed host'
      };
    }
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
    // "Transfer/replay"; SPEC.md §9). Decision logic lives in
    // evaluateDisclosureThreshold() above — pure function, independently
    // unit-tested (see testVerification.mjs).
    const { disclose, reason: thresholdReason } = evaluateDisclosureThreshold({
      signedLength: signedManifest.manifest.text_length,
      receivedLength: extracted.cleanText.length
    });

    if (thresholdReason === 'missing_text_length') {
      return {
        status: 'failed',
        reason: 'Manifest missing text_length field — cannot evaluate disclosure threshold. This manifest predates the text_length schema addition (D.6) and cannot be safely processed by this verification path.',
        signed_at: signedManifest.signed_at ?? null,
        algorithm: signedManifest.algorithm ?? null
      };
    }

    if (!disclose) {
      return {
        status: 'failed',
        reason: 'Visible text was modified after signing — content hash does not match. Original manifest withheld: received text length differs from signed text length beyond the disclosure threshold.',
        signed_at: signedManifest.signed_at ?? null,
        algorithm: signedManifest.algorithm ?? null
      };
    }

    // disclose === true here — evaluateDisclosureThreshold() already made
    // the threshold decision above. Do not recompute it; there is exactly
    // one source of truth for this decision.
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

/*
 * [D.6 REGRESSION] Manifest missing text_length field
 * Simulates a pre-D.6 manifest (text_length never existed in the
 * schema before this addition). Strips text_length from a valid
 * signed manifest's inner manifest object before it reaches
 * verifyManifest's STEP 4 comparison, to confirm the undefined
 * guard fires instead of falling through to NaN-comparison
 * behavior (NaN <= 0.10 is false, which would have silently
 * taken the withhold-original_manifest branch — wrong failure
 * mode, not a crash, which is why this needed an explicit test
 * rather than relying on it throwing naturally).
 *
 * Setup: build and sign a normal manifest, embed it, then tamper
 * the visible text (so STEP 4's hash check fails and reaches the
 * length-threshold logic at all) AND delete text_length from the
 * decompressed manifest before the length comparison runs.
 * Since compression.mjs has no code path to omit text_length
 * (unlike lv/st, which have default-omission), this test can't
 * reach the missing-field case through the real embed/extract
 * pipeline — it has to construct the scenario directly against
 * verifyManifest's internal expectations by using a hand-built
 * signedManifest-shaped object, OR by monkey-patching decompress
 * for this test only. The simpler and more honest approach:
 * this scenario cannot currently occur via any real code path in
 * this codebase, only via a hypothetical legacy manifest from
 * before D.6 shipped, which does not exist. Documenting that
 * explicitly rather than forcing an artificial test through
 * internals that don't reflect any real call path.
 */
