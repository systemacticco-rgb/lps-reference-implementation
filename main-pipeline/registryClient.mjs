import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import 'dotenv/config';

const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const REGISTRY_UNAVAILABLE = 'registry_unavailable';
const REGISTRY_RESPONSE_INVALID = 'registry_response_invalid';
const REGISTRY_TRANSPORT_ERROR_PREFIX = 'lps_registry_transport:';
// NOTE: generating_id format (identity vs. version encoding,
// UUID vs. structured string) is an open schema question — see
// SPEC.md §9. Only a minimal safety check runs here, not format
// validation, until that design decision is made deliberately.
const GENERATING_ID_SAFETY_PATTERN = /^[\x20-\x7E]{1,128}$/;

function registryQueryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function registryTransportError(code, message) {
  return registryQueryError(code, `${REGISTRY_TRANSPORT_ERROR_PREFIX}${code}:${message}`);
}

function registryFailureCode(error) {
  if (error?.code === REGISTRY_UNAVAILABLE || error?.code === REGISTRY_RESPONSE_INVALID) {
    return error.code;
  }

  const match = new RegExp(
    `${REGISTRY_TRANSPORT_ERROR_PREFIX}(registry_unavailable|registry_response_invalid):`
  ).exec(error?.message ?? '');
  return match?.[1] ?? null;
}

function throwRegistryQueryFailure(error) {
  const code = registryFailureCode(error) ?? REGISTRY_UNAVAILABLE;
  const message = code === REGISTRY_RESPONSE_INVALID
    ? 'Registry lookup returned an invalid response'
    : 'Registry query could not be completed';
  throw registryQueryError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRegistryRecord(record, { token, contentHash }) {
  if (!isPlainObject(record) ||
      typeof record.token !== 'string' || record.token.length === 0 ||
      typeof record.content_hash !== 'string' || !CONTENT_HASH_PATTERN.test(record.content_hash) ||
      typeof record.generating_id !== 'string' || record.generating_id.length === 0 ||
      typeof record.created_at !== 'string' || record.created_at.length === 0) {
    throw registryQueryError(
      REGISTRY_RESPONSE_INVALID,
      'Registry response does not contain a complete registry record'
    );
  }

  if ((token !== undefined && record.token !== token) ||
      (contentHash !== undefined && record.content_hash !== contentHash)) {
    throw registryQueryError(
      REGISTRY_RESPONSE_INVALID,
      'Registry response does not match the requested registry key'
    );
  }

  return record;
}

async function executeRegistryQuery(query) {
  try {
    const result = await query;
    if (!isPlainObject(result) || !Object.hasOwn(result, 'data') || !Object.hasOwn(result, 'error')) {
      throw registryQueryError(
        REGISTRY_RESPONSE_INVALID,
        'Registry response has an invalid query-result shape'
      );
    }
    return result;
  } catch (error) {
    const knownCode = registryFailureCode(error);
    if (knownCode !== null) throw registryQueryError(knownCode, error.message);

    const code = error instanceof SyntaxError || error?.name === 'SyntaxError'
      ? REGISTRY_RESPONSE_INVALID
      : REGISTRY_UNAVAILABLE;
    throw registryQueryError(code, 'Registry query could not be completed');
  }
}

async function registryFetch(input, init) {
  const response = await globalThis.fetch(input, init);

  // Preserve the existing PostgREST no-row response for token lookups.
  if (!response.ok && response.status !== 406) {
    throw registryTransportError(REGISTRY_UNAVAILABLE, 'Registry returned an HTTP failure response');
  }

  try {
    await response.clone().json();
  } catch {
    throw registryTransportError(REGISTRY_RESPONSE_INVALID, 'Registry returned malformed JSON');
  }

  return response;
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { global: { fetch: registryFetch } }
);


export async function registerContent({ contentHash, generatingId }) {
  if (!CONTENT_HASH_PATTERN.test(contentHash)) {
    throw new Error('registerContent: contentHash must be exactly 64 lowercase hex characters');
  }
  if (typeof generatingId !== 'string' || !GENERATING_ID_SAFETY_PATTERN.test(generatingId)) {
    throw new Error('registerContent: generatingId must be a printable ASCII string, 1-128 characters');
  }

  const token = 'lps_' + crypto.randomBytes(16).toString('hex');

  const { data, error } = await supabase
    .from('registry_records')
    .insert({
      token,
      content_hash: contentHash,
      generating_id: generatingId,
    })
    .select()
    .single();

  if (error) throw new Error(`Registry insert failed: ${error.message}`);

  return data;
}

export async function queryRegistry({ token, contentHash, queriedBy = null }) {
  const query_type = token ? 'token' : 'content_hash';

  let query = supabase.from('registry_records').select('*');

  if (token) {
    query = query.eq('token', token).single();
    const { data, error } = await executeRegistryQuery(query);
    if (error && error.code === 'PGRST116') return null;
    if (error) throwRegistryQueryFailure(error);
    return validateRegistryRecord(data, { token });
  } else if (contentHash) {
    query = query.eq('content_hash', contentHash).limit(1);
    const { data, error } = await executeRegistryQuery(query);
    if (error) throwRegistryQueryFailure(error);
    if (!Array.isArray(data)) {
      throw registryQueryError(
        REGISTRY_RESPONSE_INVALID,
        'Registry content-hash lookup did not return an array'
      );
    }
    if (data.length === 0) return null;
    if (data.length !== 1) {
      throw registryQueryError(
        REGISTRY_RESPONSE_INVALID,
        'Registry content-hash lookup returned an unexpected number of records'
      );
    }
    return validateRegistryRecord(data[0], { contentHash });
  } else {
    throw new Error('queryRegistry requires token or contentHash');
  }

  await supabase.from('usage_events').insert({
    token: data.token,
    queried_by: queriedBy,
    query_type,
  });

  return data;
}
