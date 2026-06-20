import { embedManifest as embedIntoText } from 'c2pa-text';
import { compress, encodeToCBOR } from './compression.mjs';

// Byte ceiling for method A.8 (Unicode variation selectors)
// 220 bytes leaves a 36-byte safety margin below the 256-byte hard ceiling
const A8_CEILING = 220;

export function embedManifest(visibleText, signedManifest) {
  try {
    // STEP 1 — Compress and encode the signed manifest
    // Shortcode compression reduces field name overhead
    // CBOR encoding removes JSON structural overhead
    const manifestBytes = encodeToCBOR(compress(signedManifest));

    // STEP 2 — Select embedding method based on byte count
    // A.8: one invisible block appended after visible text
    //      ceiling: 256 bytes (hard limit of variation selectors)
    // A.9: invisible markers distributed throughout the text
    //      ceiling: scales with document length, no hard limit
    if (manifestBytes.length <= A8_CEILING) {
      // Method A.8 — payload fits within variation selector ceiling
      return embedIntoText(visibleText, manifestBytes);
    } else {
      // Method A.9 — payload exceeds ceiling, use structured embedding
      return embedIntoText(visibleText, manifestBytes, { method: 'structured' });
    }

  } catch {
    throw new Error('Failed to embed manifest into text');
  }
}