import { embedManifest as embedIntoText } from 'c2pa-text';

export function embedManifest(visibleText, signedManifest) {
  try {
    const manifestString = JSON.stringify(signedManifest);
    const manifestBytes = new TextEncoder().encode(manifestString);

    return embedIntoText(visibleText, manifestBytes);
  } catch {
    throw new Error('Failed to embed manifest into text');
  }
}
