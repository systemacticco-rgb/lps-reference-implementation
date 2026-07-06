import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim();
  }
} catch {
  // no .env file present, rely on environment
}
import { createServer } from 'http';
import { pathToFileURL } from 'url';
import { createRateLimiter, RATE_LIMIT_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS } from './rateLimiter.mjs';
import { handleSignRoute } from './signRoute.mjs';
import { handleVerifyRoute } from './verifyRoute.mjs';

export const SURVIVAL_TOOL_PORT = Number(process.env.SURVIVAL_TOOL_PORT ?? 8787);
export const SURVIVAL_TOOL_FRONTEND_ORIGIN = process.env.SURVIVAL_TOOL_FRONTEND_ORIGIN ?? 'http://localhost:8080';

const rateLimit = createRateLimiter({
  requestsPerWindow: RATE_LIMIT_REQUESTS_PER_WINDOW,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

export function createSurvivalTestServer() {
  return createServer(async (req, res) => {
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      handleOptions(req, res);
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (!isToolEndpoint(url.pathname)) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (!requestMatchesFrontendOrigin(req)) {
      sendJson(res, 403, { error: 'Forbidden origin' });
      return;
    }

    if (!rateLimit(req, res)) {
      return;
    }

    if (url.pathname === '/sign' || url.pathname === '/api/sign') {
      await handleSignRoute(req, res);
      return;
    }

    await handleVerifyRoute(req, res);
  });
}

function applyCorsHeaders(req, res) {
  if (req.headers.origin === SURVIVAL_TOOL_FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', SURVIVAL_TOOL_FRONTEND_ORIGIN);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleOptions(req, res) {
  if (!requestMatchesFrontendOrigin(req)) {
    sendJson(res, 403, { error: 'Forbidden origin' });
    return;
  }

  res.writeHead(204);
  res.end();
}

function requestMatchesFrontendOrigin(req) {
  if (req.headers.origin) {
    return req.headers.origin === SURVIVAL_TOOL_FRONTEND_ORIGIN;
  }

  if (!req.headers.referer) {
    return false;
  }

  try {
    return new URL(req.headers.referer).origin === SURVIVAL_TOOL_FRONTEND_ORIGIN;
  } catch {
    return false;
  }
}

function isToolEndpoint(pathname) {
  return pathname === '/sign'
    || pathname === '/verify'
    || pathname === '/api/sign'
    || pathname === '/api/verify';
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createSurvivalTestServer().listen(SURVIVAL_TOOL_PORT, () => {
    console.log(`LPS Survival-Test Tool server listening on http://localhost:${SURVIVAL_TOOL_PORT}`);
  });
}
