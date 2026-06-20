import { embedManifest as embedIntoText } from 'c2pa-text';
import { compress, encodeToCBOR } from './compression.mjs';

export function embedManifest(visibleText, signedManifest) {
  try {
    const manifestBytes = encodeToCBOR(compress(signedManifest));

    return embedIntoText(visibleText, manifestBytes);
  } catch {
    throw new Error('Failed to embed manifest into text');
  }
}
