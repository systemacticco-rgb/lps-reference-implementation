import { readFile } from 'fs/promises';

const DEMO_PRIVATE_KEY_FILE = new URL('../demo-keys/demo-private-key.pem', import.meta.url);
const DEMO_CERTIFICATE_FILE = new URL('../demo-keys/demo-cert.pem', import.meta.url);

export const DEMO_CERT_URL = 'https://systemacticco-rgb.github.io/lps-demo-certificates/survival-test-tool/demo-cert.pem';

export async function loadDemoPrivateKey() {
  return readFile(DEMO_PRIVATE_KEY_FILE, 'utf8');
}

export async function loadDemoCertificate() {
  return readFile(DEMO_CERTIFICATE_FILE, 'utf8');
}

export async function loadDemoSigningMaterial() {
  const [privateKey, certificate] = await Promise.all([
    loadDemoPrivateKey(),
    loadDemoCertificate(),
  ]);

  return { privateKey, certificate };
}
