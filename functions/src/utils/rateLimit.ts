import { createHash } from "node:crypto";

import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";

/**
 * Fixed-window rate limiter backed by Firestore.
 *
 * Keys live under `/rateLimits/{key}` with `{ count, windowStart }`. The first
 * request in a new window resets the counter. Returns `allowed: false` once the
 * window's `count` exceeds `max`. Callers should surface a 429 with the
 * returned `retryAfterSec`.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export type RateLimitOptions = {
  windowSec: number;
  max: number;
};

export async function enforceRateLimit(
  db: Firestore,
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const ref = db.collection("rateLimits").doc(key);
  const nowMs = Date.now();
  const windowMs = opts.windowSec * 1000;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count?: number; windowStart?: Timestamp } | undefined;
    const windowStartMs = data?.windowStart ? data.windowStart.toMillis() : 0;
    const stillInWindow = windowStartMs > 0 && nowMs - windowStartMs < windowMs;
    const currentCount = stillInWindow ? Number(data?.count || 0) : 0;
    const nextCount = currentCount + 1;

    if (nextCount > opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (nowMs - windowStartMs)) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    tx.set(
      ref,
      {
        count: nextCount,
        windowStart: stillInWindow
          ? data?.windowStart || FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { allowed: true, remaining: Math.max(0, opts.max - nextCount), retryAfterSec: 0 };
  });
}

/**
 * Stable per-client fingerprint for unauthenticated / pre-auth rate-limit keys.
 *
 * GCP's HTTPS load balancer appends entries to `x-forwarded-for` in the order
 * `<client-supplied>, <real-client-ip>, <gclb-ip>`. The second-to-last entry
 * is the only one the client cannot forge. Falls back to `req.ip` when XFF
 * has fewer than two entries, and to a constant sentinel as last resort.
 */
export function clientIpKey(req: { header: (n: string) => string | undefined; ip?: string }): string {
  const xff = req.header("x-forwarded-for") || "";
  const parts = xff
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let ip = "";
  if (parts.length >= 2) {
    ip = parts[parts.length - 2] || "";
  } else if (parts.length === 1) {
    ip = parts[0] || "";
  }
  if (!ip) ip = req.ip || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
