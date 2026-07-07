// ============================================================
// embeddingLayer.mjs 
// ============================================================
import {
  embedManifest as embedIntoText,
  worstCaseWrapperByteLength
} from 'c2pa-text';
import { compress, encodeToCBOR } from './compression.mjs';

export function embedManifest(visibleText, signedManifest) {
  return embedManifestWithDiagnostics(visibleText, signedManifest).text;
}

export function embedManifestWithDiagnostics(visibleText, signedManifest) {
  try {
    // STEP 1 — Compress and encode the signed manifest
    // Shortcode compression reduces field name overhead
    // CBOR encoding removes JSON structural overhead
    const manifestBytes = encodeToCBOR(compress(signedManifest));

    // STEP 2 — Embed with Method A.8
    // A.8 uses the C2PA text wrapper encoded as Unicode variation selectors.
    // This is the path needed for editor copy/paste survival testing: the
    // visible text stays unchanged and the carrier is invisible.
    return {
      text: embedIntoText(visibleText, manifestBytes),
      embedding_method_used: 'A.8',
      manifest_byte_size: manifestBytes.length,
      visible_text_length: visibleText.length,
      wrapper_worst_case_utf8_bytes: worstCaseWrapperByteLength(manifestBytes.length)
    };

  } catch {
    throw new Error('Failed to embed manifest into text');
  }
}
