const buckets = new Map();

function createRateLimiter({ windowMs, max, keyFn }) {
  const durationMs = Number(windowMs) || 60_000;
  const maxHits = Number(max) || 60;

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn
      ? keyFn(req)
      : `${req.ip || "unknown"}:${req.baseUrl || ""}${req.path || ""}`;

    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + durationMs });
      return next();
    }

    if (current.count >= maxHits) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again shortly.",
      });
    }

    current.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
