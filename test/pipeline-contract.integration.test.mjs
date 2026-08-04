import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import {
  embedManifest as embedIntoText,
  encodeWrapper,
  extractManifest
} from 'c2pa-text';
import { compress, decodeFromCBOR, decompress, encodeToCBOR } from '../main-pipeline/compression.mjs';
import { embedManifest as embedLpsManifest } from '../main-pipeline/embeddingLayer.mjs';
import { generateManifest } from '../main-pipeline/manifestGenerator.mjs';
import { signManifest } from '../main-pipeline/signingLayer.mjs';
import { verifyManifest } from '../main-pipeline/verificationTool.mjs';

const CERT_URL = 'https://raw.githubusercontent.com/systemacticco-rgb/lps-certificates/main/cert.pem';
const REGISTRY_ORIGIN = 'http://lps-test-registry.local';
const SOURCE_TIME = '2026-08-01T00:00:00.000Z';
const localCertificate = readFileSync(new URL('../cert.pem', import.meta.url), 'utf8');
let registryMode = 'normal';
const registryRecords = new Map();
const fetchRequests = [];

const originalFetch = globalThis.fetch;
const originalSigningEnabled = process.env.SIGNING_ENABLED;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

process.env.SIGNING_ENABLED = 'true';
process.env.SUPABASE_URL = REGISTRY_ORIGIN;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'adr-test-service-key';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function requestUrl(input) {
  return new URL(input instanceof Request ? input.url : String(input));
}

globalThis.fetch = async (input, init = {}) => {
  const url = requestUrl(input);
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  fetchRequests.push({ method, url: url.toString() });

  if (url.toString() === CERT_URL) {
    return new Response(localCertificate, {
      status: 200,
      headers: { 'content-type': 'application/x-pem-file' }
    });
  }

  if (url.origin === REGISTRY_ORIGIN && url.pathname === '/rest/v1/registry_records') {
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      const record = {
        ...body,
        created_at: '2026-08-01T00:00:00.000Z'
      };
      registryRecords.set(record.content_hash, record);
      return jsonResponse(record, 201);
    }

    if (method === 'GET') {
      const byHash = url.searchParams.get('content_hash');
      if (byHash?.startsWith('eq.')) {
        if (registryMode === 'transport_failure') {
          throw new TypeError('simulated registry transport failure');
        }
        if (registryMode === 'http_503') {
          return jsonResponse({ message: 'simulated registry outage' }, 503);
        }
        if (registryMode === 'malformed_json') {
          return new Response('{not valid json', {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        if (registryMode === 'incomplete_record') {
          return jsonResponse([{}]);
        }

        const record = registryRecords.get(byHash.slice(3));
        return jsonResponse(record ? [record] : []);
      }

      const byToken = url.searchParams.get('token');
      if (byToken?.startsWith('eq.')) {
        const record = [...registryRecords.values()].find(({ token }) => token === byToken.slice(3));
        return jsonResponse(record ?? null);
      }
    }
  }

  return new Response('Unexpected test request', { status: 500 });
};

const { queryRegistry, registerContent } = await import('../main-pipeline/registryClient.mjs');

after(() => {
  globalThis.fetch = originalFetch;

  if (originalSigningEnabled === undefined) delete process.env.SIGNING_ENABLED;
  else process.env.SIGNING_ENABLED = originalSigningEnabled;

  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;

  if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
});

function canonicalText(text) {
  return text.replace(/[\r\n ]+$/, '');
}

function canonicalHash(text) {
  return createHash('sha256').update(Buffer.from(canonicalText(text), 'utf8')).digest('hex');
}

function toolSegment(text, overrides = {}) {
  return {
    segmentId: 'tool-segment',
    startOffset: 0,
    endOffset: text.length - 1,
    origin: 'human',
    confidence: 0.91,
    ...overrides
  };
}

function makeManifest(visibleText, segments = [toolSegment(visibleText)], contentSignedAt = SOURCE_TIME) {
  return generateManifest({
    visibleText,
    segments,
    signingTool: 'lps-reference-implementation-v0.1',
    contentSignedAt
  });
}

function signText(visibleText, segments, contentSignedAt) {
  return signManifest(makeManifest(visibleText, segments, contentSignedAt));
}

function embedCompressed(visibleText, compressed) {
  return embedIntoText(visibleText, encodeToCBOR(compressed));
}

function embedRawCbor(visibleText, bytes) {
  return embedIntoText(visibleText, bytes);
}

function withDuplicateTopLevelEv(compressed) {
  const bytes = Buffer.from(encodeToCBOR(compressed));

  // Current compressed envelope is a seven-entry definite CBOR map.
  assert.equal(bytes[0], 0xa7);

  return Buffer.concat([
    Buffer.from([0xa8]),                 // change map length: 7 → 8
    bytes.subarray(1),                   // retain the valid ev: 1 envelope
    Buffer.from([0x62, 0x65, 0x76, 0x02]) // append a second key: "ev": 2
  ]);
}

function resetFetchRequests() {
  fetchRequests.length = 0;
}

function registryRequests() {
  return fetchRequests.filter(({ url }) => url.startsWith(`${REGISTRY_ORIGIN}/rest/v1/registry_records`));
}

function assertOutcome(result, { status, reasonCode, carrierCondition }) {
  assert.equal(result.status, status);
  assert.equal(result.carrier_condition, carrierCondition);

  if (reasonCode === undefined) {
    assert.equal(Object.hasOwn(result, 'reason_code'), false);
  } else {
    assert.equal(result.reason_code, reasonCode);
    assert.equal(typeof result.reason, 'string');
  }
}

test('ADR_4 V3 authenticated envelope integration', { concurrency: false }, async (t) => {
  await t.test('ADR_4 V3 §2/§3: ev: 1, both timestamps, and confidence provenance survive the full pipeline', async () => {
    const visibleText = 'Café 🙂';
    const manifest = makeManifest(visibleText, [
      toolSegment(visibleText, { endOffset: 0 }),
      {
        segmentId: 'fallback-segment',
        startOffset: 1,
        endOffset: visibleText.length - 1,
        origin: 'ai_generated',
        aiTool: 'test-tool'
      }
    ]);

    assert.equal(manifest.content_signed_at, SOURCE_TIME);
    assert.equal(Object.hasOwn(manifest, 'signed_at'), false);
    assert.equal(manifest.text_length, Buffer.byteLength(visibleText, 'utf8'));
    assert.notEqual(manifest.text_length, visibleText.length);
    assert.equal(manifest.content_segments[0].confidence_source, 'tool');
    assert.equal(manifest.content_segments[1].confidence_source, 'fallback');

    const signed = signManifest(manifest);
    assert.equal(signed.ev, 1);
    assert.equal(signed.manifest.content_signed_at, SOURCE_TIME);
    assert.equal(typeof signed.signed_at, 'string');
    assert.notEqual(signed.signed_at, SOURCE_TIME);

    const recovered = decompress(decodeFromCBOR(encodeToCBOR(compress(signed))));
    assert.equal(recovered.ev, 1);
    assert.equal(recovered.manifest.content_signed_at, SOURCE_TIME);
    assert.equal(recovered.signed_at, signed.signed_at);
    assert.deepEqual(
      recovered.manifest.content_segments.map(({ confidence_source }) => confidence_source),
      ['tool', 'fallback']
    );

    const embedded = embedLpsManifest(visibleText, signed);
    assert.equal(extractManifest(embedded).cleanText, visibleText);

    resetFetchRequests();
    const result = await verifyManifest(embedded);
    assertOutcome(result, {
      status: 'verified',
      carrierCondition: 'present'
    });
    assert.equal(result.signed_at, signed.signed_at);
    assert.deepEqual(
      result.segments.map(({ confidence_source }) => confidence_source),
      ['tool', 'fallback']
    );
    assert.equal(registryRequests().length, 0);
  });

  await t.test('ADR_4 V3 §3 normalization: trailing CR, LF, and space share the documented UTF-8 text binding', async () => {
    const visibleText = 'é🙂';
    const canonical = makeManifest(visibleText);

    for (const suffix of [' ', '\n', '\r', '\r\n ']) {
      const normalized = makeManifest(visibleText + suffix);
      assert.equal(normalized.text_hash, canonical.text_hash);
      assert.equal(normalized.text_length, canonical.text_length);
    }

    assert.equal(canonical.text_length, Buffer.byteLength(visibleText, 'utf8'));
    assert.notEqual(canonical.text_length, visibleText.length);

    const signed = signText(visibleText);
    resetFetchRequests();
    const normalizedResult = await verifyManifest(embedLpsManifest(visibleText, signed) + ' \n\r');
    assertOutcome(normalizedResult, {
      status: 'verified',
      carrierCondition: 'present'
    });
    assert.equal(registryRequests().length, 0);

    const decomposedText = 'e\u0301';
    assert.throws(
      () => embedLpsManifest(decomposedText, signText(decomposedText)),
      /Failed to embed manifest into text/
    );
  });

  await t.test('ADR_4 V2 CODE-008/009: missing source time and malformed or contradictory confidence reject before signing', () => {
    const visibleText = 'confidence checks';

    assert.throws(
      () => generateManifest({
        visibleText,
        segments: [toolSegment(visibleText)],
        signingTool: 'lps-reference-implementation-v0.1'
      }),
      /contentSignedAt must be a non-empty timestamp string/
    );

    assert.throws(
      () => makeManifest(visibleText, [toolSegment(visibleText, { confidence: null })]),
      /confidence value must be a finite number/
    );

    assert.throws(
      () => makeManifest(visibleText, [toolSegment(visibleText, { confidence: Number.NaN })]),
      /confidence value must be a finite number/
    );

    assert.throws(
      () => makeManifest(visibleText, [toolSegment(visibleText, { confidenceSource: 'fallback' })]),
      /confidenceSource contradicts the supplied confidence/
    );

    const missingContentTime = makeManifest(visibleText);
    delete missingContentTime.content_signed_at;
    assert.throws(
      () => signManifest(missingContentTime),
      /content_signed_at must be a non-empty timestamp string/
    );
  });

  await t.test('ADR_4 V3 §3 version scope: missing, invalid, and unsupported ev reject before cryptographic acceptance', async () => {
    const visibleText = 'version contract';
    const signed = signText(visibleText);
    const cases = [
      {
        name: 'missing ev',
        mutate(raw) { delete raw.ev; },
        reasonCode: 'missing_ev'
      },
      {
        name: 'invalid ev type',
        mutate(raw) { raw.ev = '1'; },
        reasonCode: 'invalid_ev'
      },
      {
        name: 'invalid non-integer ev',
        mutate(raw) { raw.ev = 1.5; },
        reasonCode: 'invalid_ev'
      },
      {
        name: 'unsupported authenticated ev',
        mutate(raw) { raw.ev = 2; },
        reasonCode: 'unsupported_ev'
      }
    ];

    for (const versionCase of cases) {
      const raw = compress(structuredClone(signed));
      versionCase.mutate(raw);
      resetFetchRequests();
      const result = await verifyManifest(embedCompressed(visibleText, raw));
      assertOutcome(result, {
        status: 'unsupported_version',
        reasonCode: versionCase.reasonCode,
        carrierCondition: 'present'
      });
      assert.equal(fetchRequests.length, 0, `${versionCase.name} must reject before certificate or registry access`);
    }
  });

  await t.test('Locked decision: duplicate top-level envelope keys reject before version or I/O', async () => {
    const visibleText = 'duplicate envelope key';
    const duplicatePayload = withDuplicateTopLevelEv(
      compress(signText(visibleText))
    );

    resetFetchRequests();

    const result = await verifyManifest(
      embedRawCbor(visibleText, duplicatePayload)
    );

    assertOutcome(result, {
      status: 'invalid_envelope',
      reasonCode: 'noncanonical_encoding',
      carrierCondition: 'present'
    });
    assert.equal(fetchRequests.length, 0);
    assert.equal(Object.hasOwn(result, 'registry_record'), false);
  });

  await t.test('ADR_4 V3 validation output: parseable invalid envelopes reject before cryptographic acceptance', async () => {
    const visibleText = 'invalid envelope';
    resetFetchRequests();
    const malformedResult = await verifyManifest(embedCompressed(visibleText, { ev: 1, m: {} }));
    assertOutcome(malformedResult, {
      status: 'invalid_envelope',
      reasonCode: 'invalid_schema',
      carrierCondition: 'present'
    });
    assert.equal(fetchRequests.length, 0);

    const invalidTimestamp = signText(visibleText);
    invalidTimestamp.manifest.content_signed_at = '';
    resetFetchRequests();
    const timestampResult = await verifyManifest(embedLpsManifest(visibleText, invalidTimestamp));
    assertOutcome(timestampResult, {
      status: 'invalid_envelope',
      reasonCode: 'invalid_schema',
      carrierCondition: 'present'
    });
    assert.equal(fetchRequests.length, 0);

    const invalidEnvelopeTimestamp = signText(visibleText);
    invalidEnvelopeTimestamp.signed_at = '';
    resetFetchRequests();
    const envelopeTimestampResult = await verifyManifest(embedLpsManifest(visibleText, invalidEnvelopeTimestamp));
    assertOutcome(envelopeTimestampResult, {
      status: 'invalid_envelope',
      reasonCode: 'invalid_schema',
      carrierCondition: 'present'
    });
    assert.equal(fetchRequests.length, 0);

    const invalidConfidenceSource = signText(visibleText);
    invalidConfidenceSource.manifest.content_segments[0].confidence_source = 'unknown';
    resetFetchRequests();
    const confidenceResult = await verifyManifest(embedLpsManifest(visibleText, invalidConfidenceSource));
    assertOutcome(confidenceResult, {
      status: 'invalid_envelope',
      reasonCode: 'invalid_schema',
      carrierCondition: 'present'
    });
    assert.equal(fetchRequests.length, 0);
  });

  await t.test('ADR_4 V2 CODE-004/005: both authenticated timestamps fail signature verification when altered after signing', async () => {
    const visibleText = 'timestamp binding';
    const signed = signText(visibleText);

    const alteredEnvelopeTime = structuredClone(signed);
    alteredEnvelopeTime.signed_at = '2030-01-01T00:00:00.000Z';
    const envelopeTimeResult = await verifyManifest(embedLpsManifest(visibleText, alteredEnvelopeTime));
    assertOutcome(envelopeTimeResult, {
      status: 'failed',
      reasonCode: 'signature_invalid',
      carrierCondition: 'present'
    });

    const alteredContentTime = structuredClone(signed);
    alteredContentTime.manifest.content_signed_at = '2031-01-01T00:00:00.000Z';
    const contentTimeResult = await verifyManifest(embedLpsManifest(visibleText, alteredContentTime));
    assertOutcome(contentTimeResult, {
      status: 'failed',
      reasonCode: 'signature_invalid',
      carrierCondition: 'present'
    });
  });

  await t.test('ADR_4 V2 CODE-006/007: hash and UTF-8 byte-length mismatches have distinct ADR reason codes', async () => {
    const visibleText = 'length 🙂';
    const signed = signText(visibleText);

    const hashMismatch = await verifyManifest(embedLpsManifest(visibleText, signed) + 'x');
    assertOutcome(hashMismatch, {
      status: 'failed',
      reasonCode: 'text_hash_mismatch',
      carrierCondition: 'present'
    });

    const wrongLengthManifest = makeManifest(visibleText);
    wrongLengthManifest.text_length += 1;
    const lengthMismatch = await verifyManifest(embedLpsManifest(visibleText, signManifest(wrongLengthManifest)));
    assertOutcome(lengthMismatch, {
      status: 'failed',
      reasonCode: 'text_length_mismatch',
      carrierCondition: 'present'
    });
  });

  await t.test('ADR_4 V2 CODE-011: registry registration, exact-hash lookup, and absent-carrier recovery are deterministic', async () => {
    const registeredText = 'registered fallback text \r\n ';
    const contentHash = canonicalHash(registeredText);
    const record = await registerContent({
      contentHash,
      generatingId: 'adr-integration-test'
    });
    const lookup = await queryRegistry({ contentHash });
    assert.equal(lookup.token, record.token);
    assert.equal(lookup.content_hash, contentHash);

    const matched = await verifyManifest(registeredText);
    assertOutcome(matched, {
      status: 'registry_required',
      reasonCode: 'registry_match',
      carrierCondition: 'absent'
    });
    assert.equal(matched.registry_record.content_hash, contentHash);

    const missed = await verifyManifest('unregistered fallback text');
    assertOutcome(missed, {
      status: 'degraded',
      reasonCode: 'registry_no_match',
      carrierCondition: 'absent'
    });
  });

  await t.test('Locked decisions: registry failures and incomplete records do not become no-match', async () => {
    const cases = [
      { mode: 'transport_failure', reasonCode: 'registry_unavailable' },
      { mode: 'http_503', reasonCode: 'registry_unavailable' },
      { mode: 'malformed_json', reasonCode: 'registry_response_invalid' },
      { mode: 'incomplete_record', reasonCode: 'registry_response_invalid' }
    ];

    for (const { mode, reasonCode } of cases) {
      const visibleText = `registry boundary: ${mode}`;
      const contentHash = canonicalHash(visibleText);
      registryMode = mode;

      try {
        await assert.rejects(
          () => queryRegistry({ contentHash }),
          error => error?.code === reasonCode
        );

        resetFetchRequests();
        const result = await verifyManifest(visibleText);
        assertOutcome(result, {
          status: 'degraded',
          reasonCode,
          carrierCondition: 'absent'
        });
        assert.equal(Object.hasOwn(result, 'registry_record'), false);
        assert.ok(registryRequests().length >= 1);
      } finally {
        registryMode = 'normal';
      }
    }
  });

  await t.test('ADR_4 V3 carrier table: corrupted and unparseable recovery preserve match state and carrier condition', async () => {
    const corruptedMatchText = 'corrupted carrier match';
    await registerContent({
      contentHash: canonicalHash(corruptedMatchText),
      generatingId: 'adr-corrupted-match'
    });
    const corruptedFragment = Array.from(encodeWrapper(new Uint8Array())).slice(0, 10).join('');
    const corruptedMatch = await verifyManifest(corruptedMatchText + corruptedFragment);
    assertOutcome(corruptedMatch, {
      status: 'registry_required',
      reasonCode: 'registry_match',
      carrierCondition: 'corrupted'
    });

    const corruptedMiss = await verifyManifest('corrupted carrier miss' + corruptedFragment);
    assertOutcome(corruptedMiss, {
      status: 'degraded',
      reasonCode: 'registry_no_match',
      carrierCondition: 'corrupted'
    });

    const unparseableMatchText = 'unparseable carrier match';
    await registerContent({
      contentHash: canonicalHash(unparseableMatchText),
      generatingId: 'adr-unparseable-match'
    });
    const unparseableMatch = await verifyManifest(embedCompressed(unparseableMatchText, 42));
    assertOutcome(unparseableMatch, {
      status: 'registry_required',
      reasonCode: 'registry_match',
      carrierCondition: 'unparseable'
    });

    const unparseableMiss = await verifyManifest(embedCompressed('unparseable carrier miss', 42));
    assertOutcome(unparseableMiss, {
      status: 'degraded',
      reasonCode: 'registry_no_match',
      carrierCondition: 'unparseable'
    });
  });
});
