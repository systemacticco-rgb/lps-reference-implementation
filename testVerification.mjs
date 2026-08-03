import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { embedManifest } from './embeddingLayer.mjs';
import { signManifest } from './signingLayer.mjs';
import { generateManifest } from './manifestGenerator.mjs';
import { verifyManifest } from './verificationTool.mjs';

const visibleText = 'This is human written. This part was AI generated.';
const contentSignedAt = '2026-08-02T00:00:00.000Z';
const originalFetch = globalThis.fetch;
const originalSigningEnabled = process.env.SIGNING_ENABLED;

process.env.SIGNING_ENABLED = 'true';

try {
  const manifest = generateManifest({
    visibleText,
    segments: [
      { segmentId: 1, startOffset: 0, endOffset: 21, origin: 'human', confidence: 0.95 },
      { segmentId: 2, startOffset: 22, endOffset: 49, origin: 'ai_generated', confidence: 0.88, aiTool: 'claude-sonnet' }
    ],
    signingTool: 'lps-reference-implementation-v0.1',
    contentSignedAt
  });

  assert.equal(manifest.content_signed_at, contentSignedAt);
  assert.equal(Object.hasOwn(manifest, 'signed_at'), false);

  const signedManifest = signManifest(manifest);
  const embeddedText = embedManifest(visibleText, signedManifest);
  const localCertificate = readFileSync(new URL('./cert.pem', import.meta.url), 'utf8');
  let certificateFetches = 0;

  globalThis.fetch = async (input) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (requestUrl === signedManifest.cert_url) {
      certificateFetches += 1;
      return new Response(localCertificate, {
        status: 200,
        headers: { 'content-type': 'application/x-pem-file' }
      });
    }
    throw new Error('Unexpected network request during local verification test');
  };

  const verified = await verifyManifest(embeddedText);
  assert.equal(verified.status, 'verified');
  assert.equal(verified.carrier_condition, 'present');
  assert.equal(Object.hasOwn(verified, 'reason_code'), false);
  assert.deepEqual(
    verified.segments.map((segment) => ({
      segment_id: segment.segment_id,
      origin: segment.origin,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      confidence: segment.confidence,
      confidence_source: segment.confidence_source,
      ai_tool: segment.ai_tool,
      modification_degree: segment.modification_degree
    })),
    [
      {
        segment_id: 1,
        origin: 'human',
        start_offset: 0,
        end_offset: 21,
        confidence: 95,
        confidence_source: 'tool',
        ai_tool: null,
        modification_degree: null
      },
      {
        segment_id: 2,
        origin: 'ai_generated',
        start_offset: 22,
        end_offset: 49,
        confidence: 88,
        confidence_source: 'tool',
        ai_tool: 'claude-sonnet',
        modification_degree: null
      }
    ]
  );

  const tampered = await verifyManifest(embeddedText + ' TAMPERED');
  assert.equal(tampered.status, 'failed');
  assert.equal(tampered.reason_code, 'text_hash_mismatch');
  assert.equal(tampered.carrier_condition, 'present');
  assert.equal(certificateFetches, 2);
} finally {
  globalThis.fetch = originalFetch;
  if (originalSigningEnabled === undefined) delete process.env.SIGNING_ENABLED;
  else process.env.SIGNING_ENABLED = originalSigningEnabled;
}

console.log('PASS: local verification assertions passed');
