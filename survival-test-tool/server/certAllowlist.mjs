export const ALLOWED_CERT_SOURCES = Object.freeze([
  {
    hostname: 'raw.githubusercontent.com',
    pathPrefix: '/systemacticco-rgb/lps-reference-implementation/',
  },
  {
    hostname: 'systemacticco-rgb.github.io',
    pathPrefix: '/lps-demo-certificates/survival-test-tool/',
  },
]);

export function validateCertUrl(certUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(certUrl);
  } catch {
    return { allowed: false, parsedUrl: null };
  }

  if (parsedUrl.protocol !== 'https:') {
    return { allowed: false, parsedUrl: null };
  }

  const matchedSource = ALLOWED_CERT_SOURCES.find(
    (source) => source.hostname === parsedUrl.hostname && parsedUrl.pathname.startsWith(source.pathPrefix)
  );

  return matchedSource
    ? { allowed: true, parsedUrl }
    : { allowed: false, parsedUrl: null };
}

export function isAllowedCertUrl(certUrl) {
  return validateCertUrl(certUrl).allowed;
}