AUDIT HARNESS — LPS Adversarial Test and Output Quality Evaluation
Purpose: functional correctness, security resilience, and output
completeness audit of the full LPS pipeline including PROPOSAL 005.
Run only after PROPOSAL 005 is implemented and all existing tests pass.

═══════════════════════════════════════════
WHAT THIS HARNESS IS
═══════════════════════════════════════════

A single file — testAuditHarness.mjs — that runs the full pipeline,
introduces controlled degradations, and evaluates two things per test:

1. CORRECTNESS — did verifyManifest() return the right status
   and the right fields for this specific degradation scenario.

2. OUTPUT COMPLETENESS — does the returned object contain enough
   information to reconstruct a full forensic narrative of what
   happened to the document after it left the generating system.

Each test is self-contained. Each test prints a structured report.
The harness does not stop on failure — it runs every test and
collects all results before printing the final summary.

═══════════════════════════════════════════
DOCUMENT USED ACROSS ALL TESTS
═══════════════════════════════════════════

A realistic multi-paragraph document with all three origin types
represented across multiple segments. Long enough to carry four
full manifest copies via PROPOSAL 005. Paragraph boundaries
explicitly defined. The same document is used for every test
so results are comparable across degradation scenarios.

visibleText: four paragraphs, minimum 200 characters each.
segments: six segments covering all three origin types.
signingTool: 'lps-reference-implementation-v0.1'
paragraphBoundaries: detected from newline positions.

The baseline embedded document is generated once at harness startup
and reused across all tests. Any test that needs a modified version
starts from this baseline and applies its specific degradation.

═══════════════════════════════════════════
SECTION 1 — BASELINE CORRECTNESS CHECKS
═══════════════════════════════════════════

These confirm the pipeline works correctly before any degradation.
All must pass before adversarial tests run. If any baseline check
fails the harness stops and reports which component is broken.

CHECK B1 — Clean verification
Input: baseline embedded document, untampered.
Expected status: verified
Expected fields present: status, signed_at, algorithm,
  overall_ai_proportion, human_proportion, segments array,
  anchor_layer: present
Audit: confirm every segment in output matches every segment
  in the original manifest — segment_id, origin, confidence,
  confidence_source, start_offset, end_offset, ai_tool where
  applicable, modification_degree where applicable.

CHECK B2 — Text hash integrity
Input: baseline embedded document.
After verification, re-hash extracted cleanText independently
using SHA-256 and compare against text_hash in verified output.
Expected: hashes match.
Audit: confirms extractManifest() returns clean text without
  invisible characters contaminating the hash input.

CHECK B3 — Segment proportion accuracy
Input: baseline embedded document.
After verification, recompute overall_ai_proportion and
human_proportion independently from segment offsets in output.
Expected: computed values match returned values within 0.01.
Audit: confirms proportion fields are accurate not approximate.

CHECK B4 — Anchor layer present and consistent
Input: baseline embedded document.
Expected: anchor_layer field is 'present' in verified output.
Extract anchor fields independently and confirm text_hash
in anchor matches text_hash in full manifest.
Audit: confirms anchor embedding and extraction round trip.

CHECK B5 — Certificate chain valid
Input: baseline embedded document.
Fetch cert from cert_url in verified output.
Hash fetched cert. Compare against cert_fingerprint in output.
Expected: fingerprints match.
Audit: confirms certificate delivery and fingerprint check
work end to end against live GitHub URL.

CHECK B6 — Overlapping segment boundary detection
Input: generateManifest() called with two segments whose
  offset ranges overlap.
Expected: throws with descriptive error before manifest
  is produced. Does not silently produce wrong proportions.
Audit: confirm error message identifies which segments conflict
  and what the overlapping range is.
  Confirm no manifest object returned on invalid input.

═══════════════════════════════════════════
SECTION 2 — SIGNAL DEGRADATION CHECKS
═══════════════════════════════════════════

These simulate realistic ways a document loses its embedded signal
after leaving the generating system. Each check confirms the correct
fallback status is returned and the correct fields are present.

CHECK D1 — Full signal strip
Input: visibleText only — no embedding. Not registered.
Expected status: degraded
Expected fields: status, reason, anti_forensic_note
Audit: confirm anti_forensic_note is present and non-empty.
  Confirm no segment data leaked in degraded output.

CHECK D2 — Full signal strip with registry record
Input: visibleText only — no embedding. Registered before test.
Expected status: registry_required
Expected fields: status, reason, registry_record with token,
  content_hash, generating_id, created_at
Audit: confirm registry_record fields are complete.
  Confirm content_hash in registry_record matches SHA-256
  of received visibleText computed independently.

CHECK D3 — Partial paragraph copy — one paragraph
Input: first paragraph of embedded document only.
Expected status: verified (one complete copy survives)
  or partial_recovery if copy did not fit in one paragraph.
Audit: confirm segment breakdown present if verified.
  Confirm reconstruction_completeness present if partial_recovery.
  Confirm anchor_layer reflects anchors found in that paragraph.

CHECK D4 — Partial paragraph copy — two paragraphs
Input: first two paragraphs of embedded document.
Expected status: verified
Audit: confirm two anchor manifests were found.
  Confirm full manifest recovered from copy overlap zone.

CHECK D5 — Single sentence copy
Input: one sentence extracted from middle of document.
Expected status: degraded or anchor_only
Audit: confirm system does not crash on very short input.
  Confirm appropriate status returned with no false positives.

CHECK D6 — Platform Unicode strip simulation
Input: baseline embedded document with all non-ASCII
  characters removed using regex replace.
Expected status: degraded or registry_required
Audit: confirm magic prefix detection correctly finds nothing.
  Confirm registry fallback runs automatically.

CHECK D7 — Empty and minimal input
Input A: empty string passed to verifyManifest().
Input B: single character string passed to verifyManifest().
Input C: whitespace-only string passed to verifyManifest().
Expected: degraded for all three. No crash. No unhandled error.
Audit: confirm error boundaries hold at minimum viable input.
  Confirm anti_forensic_note present in all three outputs.

═══════════════════════════════════════════
SECTION 3 — TAMPERING AND ADVERSARIAL CHECKS
═══════════════════════════════════════════

These simulate active attempts to modify, forge, or manipulate
the document or its embedded signal after generation.

CHECK A1 — Visible text append
Input: baseline embedded document with ' TAMPERED' appended.
Expected status: failed
Expected fields: status, reason, anchor_layer
Expected: original_manifest present only if text length
  within 10% of original. ' TAMPERED' is 9 characters —
  confirm whether threshold triggers based on document length.
Audit: confirm reason explicitly states visible text modified.
  Confirm signed_at present so tamper timeline is clear.

CHECK A2 — Visible text replace — single word
Input: baseline embedded document with one word in middle
  replaced with different word of same length.
Expected status: failed
Audit: confirm system detects single word change.
  Confirm original_manifest returned — single word change
  is within 10% threshold for most document lengths.
  Confirm original segment breakdown visible in output.

CHECK A3 — Visible text delete — full paragraph
Input: baseline embedded document with third paragraph removed.
Expected status: failed
Audit: confirm text hash mismatch detected.
  Confirm anchor text_hash conflicts with received text hash
  and this conflict is surfaced in output.
  Confirm original_manifest threshold decision logged.

CHECK A4 — Manifest field alteration simulation
Input: extract embedded signal, decode, alter
  overall_ai_proportion to 0.0, re-encode, re-embed.
Expected status: failed
Expected reason: signature invalid
Audit: confirm system catches manifest alteration via
  signature check not text hash check. These are two
  separate failure modes and must be distinguishable
  in the output.

CHECK A5 — Replay attack
Input: take signed manifest from a different document.
  Embed it into the baseline visible text.
Expected status: failed
Expected reason: content hash mismatch
Audit: confirm system correctly identifies that manifest
  describes different text than what was received.
  Confirm original_manifest from the replayed document
  is returned so the forensic examiner can identify
  which document the manifest actually belongs to.

CHECK A6 — Certificate substitution
Input: baseline embedded document with cert_url replaced
  to point to a different certificate.
Expected status: failed
Expected reason: certificate fingerprint mismatch
Audit: confirm fingerprint check runs before signature check.
  Confirm failed status returned immediately on mismatch
  without attempting signature verification.

CHECK A7 — Injection detection
Input: baseline embedded document with additional chunks
  prepended — chunks carrying a forged manifest signed
  with a different keypair, copy_id=99.
Expected status: injection_detected
Expected fields: session_cert_fingerprint,
  injected_cert_fingerprint
Audit: confirm both fingerprints present and different.
  Confirm legitimate manifest still recovered and returned
  alongside injection report.

CHECK A8 — Magic prefix collision
Input: baseline embedded document with 50 random buffers
  injected that begin with magic prefix bytes but fail
  secondary validation — type field set to 5.
Expected status: verified — forged buffers discarded silently.
Audit: confirm verified status unaffected by injected buffers.
  Confirm no error thrown during buffer classification.

CHECK A9 — Anchor HMAC forgery
Input: baseline embedded document with all anchor buffers
  replaced by recomputed anchors with falsified proportions
  but invalid HMAC.
Expected status: verified with anchor_layer: absent
  (forged anchors discarded, legitimate chunks still present)
  or anchor_layer: conflict if some legitimate anchors survive.
Audit: confirm forged anchors do not affect verified output.
  Confirm anchor_layer field accurately reflects what survived.

CHECK A10 — Registry poisoning attempt
Input: attempt to register a content hash that is not
  64 lowercase hex characters.
  Attempt to register with a malformed generating_id.
Expected: both throw validation errors before insert runs.
Audit: confirm error messages do not leak internal state.
  Confirm Supabase insert never called on invalid input.

CHECK A11 — HMAC timing safety
Input: run verifyAnchorHMAC() 1000 times with HMACs that
  differ only in the last byte. Record response times.
  Run 1000 times with HMACs that differ in the first byte.
  Compare average response times between both sets.
Expected: no statistically significant timing difference
  between early-mismatch and late-mismatch comparisons.
Audit: confirms timingSafeEqual() is used not standard equality.
  A timing difference here is a critical security failure.
  Additionally confirm buildAnchor() and verifyAnchorHMAC() both
  derive key material via crypto.hkdfSync with identical salt/
  info/length parameters — a parameter mismatch between the two
  call sites would cause every legitimate anchor to silently
  fail HMAC validation, indistinguishable from a forged anchor.
  Flag as SECURITY GAP, not OUTPUT GAP, if any mismatch found —
  this would be a correctness bug masquerading as a security
  feature.

CHECK A12 — Double embedding behavior
Input: take a verified embedded document and pass it through
  embedManifest() a second time with a new signed manifest.
  Pass the result to verifyManifest().
Expected: system does not crash. Returns either verified
  with the most recent manifest or a defined conflict status.
Audit: confirm which manifest wins — first or last embedded.
  Confirm output explicitly states multiple embedding layers
  were detected if applicable. Flag undefined behavior as
  SECURITY GAP if output is ambiguous about which manifest
  was used for verification.

═══════════════════════════════════════════
SECTION 4 — RECONSTRUCTION RESILIENCE CHECKS
═══════════════════════════════════════════

These test PROPOSAL 005 cross-copy reconstruction specifically.
Simulate chunk loss at varying levels and confirm reconstruction
attempts the correct path and returns the correct completeness.

CHECK R1 — Single copy complete, others absent
Input: embedded document with Copy B and Copy C chunks
  manually removed before verification.
Expected status: verified — Copy A alone sufficient.
Audit: confirm reconstruction_completeness not present
  in verified output — full recovery does not report
  completeness percentage, only partial_recovery does.

CHECK R2 — No complete copy — overlapping survivors
Input: remove chunks 001–010 from Copy A,
  chunks 025–035 from Copy B,
  chunks 050–060 from Copy C.
  Gaps are at different seq positions across copies.
Expected status: verified via cross-copy reconstruction.
Audit: confirm all three copy_ids contributed to recovery.
  Confirm checksum validation passed on assembled buffer.
  Confirm full segment breakdown present in output.

CHECK R3 — Majority chunks missing — partial recovery
Input: remove 60% of chunks from every copy randomly.
Expected status: partial_recovery
Expected fields: reconstruction_completeness below 50,
  low_confidence_reconstruction: true,
  missing_seq_positions array non-empty,
  anchor_fields present from surviving anchors.
Audit: confirm segment array absent or explicitly labeled
  as partial. Confirm expected_segment_count present
  from anchor manifest so reader knows what is missing.

CHECK R4 — All chunks missing — anchor only
Input: remove all chunks from all copies.
  Anchors intact.
Expected status: anchor_only
Expected fields: text_hash, overall_ai_proportion,
  human_proportion, algorithm, signed_at from anchors.
Audit: confirm no segment data present in output.
  Confirm anchor_layer: present.
  Confirm system attempted registry before returning anchor_only.

CHECK R5 — Chunk 001 missing across all copies
Input: remove seq position 001 from every copy.
Expected status: partial_recovery or verified depending
  on whether checksum can be reconstructed.
Audit: confirm checksum validation failure is reported
  explicitly if chunk 001 unrecoverable.
  Confirm system falls back to anchor fields.

CHECK R6 — Reconstruction completeness accuracy
Input: remove exactly 30 chunks from a known total.
Expected: reconstruction_completeness equals
  floor(((total - 30) / total) * 100).
Audit: confirm completeness percentage is mathematically
  accurate not estimated.

CHECK R7 — Minimum viable plan flag in output
Input: embed a document short enough to trigger
  minimum_viable_plan in paragraphAnalysis().
  Verify the resulting embedded document.
Expected: verified output contains minimum_viable_plan: true
  or equivalent flag indicating reduced redundancy.
Audit: confirm flag survives from paragraphAnalysis() through
  embeddingLayer.mjs into verificationTool.mjs output.
  Flag as OUTPUT GAP if absent — a forensic examiner must
  know whether full redundancy was active at generation time.

═══════════════════════════════════════════
SECTION 5 — OUTPUT COMPLETENESS AUDIT
═══════════════════════════════════════════

These checks evaluate whether verifyManifest() output contains
enough information to write a full forensic narrative.
Each check defines what a complete output must contain
for a specific scenario. Missing fields are reported as gaps.

CHECK O1 — Verified output forensic completeness
For a clean verified document confirm output contains:
  — When it was signed: signed_at
  — Who signed it: cert_url, cert_fingerprint, algorithm
  — What proportion was AI: overall_ai_proportion
  — What proportion was human: human_proportion
  — Exact character ranges for each segment: start_offset,
    end_offset per segment
  — Origin of each segment: origin per segment
  — Which AI tool was involved: ai_tool per segment where applicable
  — How much AI modified human text: modification_degree
    per segment where applicable
  — How confident the classification is: confidence,
    confidence_source per segment
  — Whether provenance redundancy survived: anchor_layer
  — Whether registry was consulted: implicit in status path
Report any missing field as OUTPUT GAP with field name.
— How confidence was determined: confidence_source per segment
    must be present and must be one of: tool, derived, fallback.
    A confidence value without its source is forensically
    incomplete. Flag absence as OUTPUT GAP.

CHECK O2 — Failed output forensic completeness
For a tampered document confirm output contains:
  — What specifically failed: reason field non-generic
  — When it was originally signed: signed_at
  — What the document looked like at signing: original_manifest
    with full segment breakdown when threshold permits
  — Whether the manifest itself was altered or only the text:
    this must be distinguishable from the reason field alone.
    Signature failure = manifest altered.
    Hash failure = text altered, manifest genuine.
    These are different events. Output must make this clear.
Report any missing field or ambiguity as OUTPUT GAP.

CHECK O3 — Partial recovery forensic completeness
For a partially recovered document confirm output contains:
  — How much was recovered: reconstruction_completeness
  — Which parts are missing: missing_seq_positions
  — What was recovered from anchors: anchor_fields
  — How many segments were expected: expected_segment_count
  — How many segments were recovered: actual segment count
    in partial output if any
  — Clear label that output is incomplete: low_confidence flag
Report any missing field as OUTPUT GAP.

CHECK O4 — Degraded output forensic completeness
For a document with no signal confirm output contains:
  — That absence is forensically significant: anti_forensic_note
  — Whether registry was checked: implicit in status
  — What hash was used for registry lookup: this is currently
    not returned in degraded output. Flag as OUTPUT GAP if absent.
Report any missing field as OUTPUT GAP.

CHECK O5 — Narrative coherence test
For each status type construct a one-paragraph plain English
narrative of what happened to the document using only the
fields present in the output. If the narrative cannot be
constructed without inferring information not in the output —
report the missing inference point as OUTPUT GAP with
a description of what field would close it.

CHECK O6 — Registry required output forensic completeness
For a registry_required document confirm output contains:
  — That the signal is absent: reason field
  — That the content was registered: registry_record present
  — When it was registered: created_at in registry_record
  — What system registered it: generating_id in registry_record
  — The exact hash that matched: content_hash in registry_record
  — The token for future lookup: token in registry_record
  — Whether the received text is identical to registered text:
    this is currently implicit — the hash matched therefore
    text is identical. But this inference is not stated
    explicitly in the output. Flag as OUTPUT GAP.
  — Whether anchor manifests survived despite signal strip:
    anchor_layer field must be present in registry_required
    output. Currently not defined. Flag as OUTPUT GAP if absent.

═══════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════

Each check prints:

CHECK [ID] — [NAME]
Status:   PASS | FAIL | OUTPUT GAP
Expected: [what was expected]
Received: [what verifyManifest() returned — status field only]
Detail:   [specific field missing, wrong value, or gap description]
          Omit if PASS.

Final summary:
TOTAL CHECKS: N
PASSED: N
FAILED: N
OUTPUT GAPS: N
SECURITY GAPS: N

Output gaps are not failures — they are missing fields that
would make the forensic output more complete. They are reported
separately so they can be addressed as output improvements
without conflating them with correctness failures.

Security gaps are checks where the system returned the wrong
status or failed to detect an adversarial input. These are
critical and must be resolved before any production deployment.