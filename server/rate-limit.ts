import type { MiddlewareHandler } from 'hono';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyOf: (c: Parameters<MiddlewareHandler>[0]) => string;
}

/** Fixed-window, in-memory, per client key. */
export function rateLimit({ limit, windowMs, keyOf }: RateLimitOptions): MiddlewareHandler {
  const windows = new Map<string, { start: number; count: number }>();
  return async (c, next) => {
    const now = Date.now();
    const key = keyOf(c);
    let w = windows.get(key);
    if (!w || now - w.start >= windowMs) {
      w = { start: now, count: 0 };
      windows.set(key, w);
      if (windows.size > 10_000) {
        for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
      }
    }
    w.count += 1;
    if (w.count > limit) {
      c.header('Retry-After', String(Math.ceil((w.start + windowMs - now) / 1000)));
      return c.json({ error: 'rate_limited' }, 429);
    }
    await next();
  };
}
