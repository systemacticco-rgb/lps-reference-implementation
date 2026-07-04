import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
// NOTE: generating_id format (identity vs. version encoding,
// UUID vs. structured string) is an open schema question — see
// SPEC.md §9. Only a minimal safety check runs here, not format
// validation, until that design decision is made deliberately.
const GENERATING_ID_SAFETY_PATTERN = /^[\x20-\x7E]{1,128}$/;


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
    query = query.eq('token', token);
  } else if (contentHash) {
    query = query.eq('content_hash', contentHash);
  } else {
    throw new Error('queryRegistry requires token or contentHash');
  }

  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw new Error(`Registry query failed: ${error.message}`);

  await supabase.from('usage_events').insert({
    token: data.token,
    queried_by: queriedBy,
    query_type,
  });

  return data;
}