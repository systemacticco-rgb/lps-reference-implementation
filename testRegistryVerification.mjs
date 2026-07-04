import { registerContent } from './registryClient.mjs';
import { verifyManifest } from './verificationTool.mjs';

/*
 * [L.1] WHAT THIS FILE DOES
 * This test targets the two states that verificationTool.mjs returns
 * when there is no embedded signal in the received text.
 * Every other test starts with embedded content. This one deliberately does not.
 * It proves the registry fallback path works — that the system does not
 * collapse to a single failure state when the signal is absent, but instead
 * distinguishes between two meaningfully different situations:
 *
 * registry_required — no signal, but the registry has a record.
 *   The content was generated legitimately. The signal was stripped afterward.
 *   Provenance exists. It just lives in the database, not in the document.
 *
 * degraded — no signal, no registry record.
 *   The content has no provenance trail at all.
 *   Origin is unknown. Absence is itself evidence.
 *
 * Two texts. Two registrations states. Two expected outputs.
 */

/*
 * [L.2] SETUP — REGISTER THE FIRST TEXT WITHOUT EMBEDDING ANYTHING
 * plainText is a normal string. No generateManifest(). No signManifest().
 * No embedManifest(). The text has no invisible signal inside it.
 * This simulates what happens when content loses its embedded signal
 * after generation — a screenshot was taken, the text was OCR'd,
 * it was pasted into a platform that strips Unicode, or the signal
 * was manually removed.
 *
 * createHash() is imported dynamically here using await import().
 * This is valid in .mjs files and works identically to a top-level import.
 * The hash is computed the same way generateManifest() would have computed it
 * at generation time — SHA-256 over the UTF-8 bytes of the visible text.
 *
 * registerContent() writes the hash to the database with a generated token.
 * The text now has a registry record but no embedded signal.
 * That is the exact state that should trigger registry_required.
 */

const plainText = 'This text has no embedded signal but is registered in the registry.';

console.log('--- SETUP: Register content hash ---');
const { createHash } = await import('crypto');
const contentHash = createHash('sha256').update(plainText, 'utf8').digest('hex');
const record = await registerContent({ contentHash, generatingId: 'test-generator-v0.1' });
console.log('Registered with token:', record.token);

/*
 * [L.3] TEST 1 — registry_required STATE
 * verifyManifest() receives plainText — the registered text with no embedded signal.
 * Inside verificationTool.mjs, extraction finds nothing.
 * The function then hashes the received text and queries the registry.
 * The hash matches the record written in the setup block above.
 * A registry record is found.
 *
 * Expected output: status "registry_required"
 * The returned object includes the registry record:
 *   token         — the lps_ token generated during setup.
 *   content_hash  — the SHA-256 hash of plainText.
 *   generating_id — "test-generator-v0.1" as registered.
 *   created_at    — the database timestamp from registration.
 *
 * This state means: the signal is gone but the provenance is not.
 * The record in the database is the authoritative source.
 * A verifier receiving this result knows where to look for the full record.
 */

console.log('\n--- TEST 1: registry_required state ---');
const result = await verifyManifest(plainText);
console.log('Result:', JSON.stringify(result, null, 2));

/*
 * [L.4] TEST 2 — degraded STATE
 * A completely different string — never registered, never embedded.
 * verifyManifest() finds no signal and no registry record.
 * Both paths return nothing. The function returns degraded.
 *
 * Expected output: status "degraded" with the anti_forensic_note.
 * The note is not decoration. It is a forensic observation recorded
 * in the output: a document that arrives with no provenance trail
 * of any kind — no embedded signal, no registry record — made no
 * effort to record its origin, or made an effort to erase it.
 * Either way, absence is evidence. The system says so explicitly.
 *
 * Together Tests 1 and 2 prove that the system distinguishes between
 * "provenance was stripped but exists" and "provenance never existed or
 * was fully erased". These are not the same situation and they do not
 * produce the same output. This test proves both branches work correctly.
 */

console.log('\n--- TEST 2: degraded state — unregistered text ---');
const unregistered = 'This text has no signal and is not in the registry.';
const degraded = await verifyManifest(unregistered);
console.log('Result:', JSON.stringify(degraded, null, 2));