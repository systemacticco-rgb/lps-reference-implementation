export const PROVISIONAL_RATE_LIMIT_REQUESTS_PER_WINDOW = 60;
export const PROVISIONAL_RATE_LIMIT_WINDOW_MS = 60_000;

export function createRateLimiter({
  requestsPerWindow = PROVISIONAL_RATE_LIMIT_REQUESTS_PER_WINDOW,
  windowMs = PROVISIONAL_RATE_LIMIT_WINDOW_MS,
} = {}) {
  const buckets = new Map();

  return function rateLimit(req, res) {
    const ipAddress = req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const existing = buckets.get(ipAddress);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(ipAddress, bucket);

    pruneExpiredBuckets(buckets, now);

    if (bucket.count > requestsPerWindow) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Too many requests' }));
      return false;
    }

    return true;
  };
}

function pruneExpiredBuckets(buckets, now) {
  for (const [ipAddress, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(ipAddress);
    }
  }
}
