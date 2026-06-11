/**
 * Canonical list of origins permitted to call our API.
 *
 * Used both as the `cors` option on `onRequest()` (Firebase echoes the
 * matching `Origin` automatically) and inside handlers that set CORS headers
 * manually. Keep this list in sync with deployed hosting domains.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  "https://proplead.io",
  "https://www.proplead.io",
  "https://app.proplead.io",
  "https://real-estate-idealista-bot.web.app",
  "https://real-estate-idealista-bot.firebaseapp.com",
];

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_ORIGINS);

/**
 * Echo the request `Origin` only if it appears in the allow-list. Returns
 * `null` (i.e. no CORS header) when the origin is unknown — browsers will
 * then block cross-origin reads of the response.
 */
export function pickAllowedOrigin(originHeader: string | null | undefined): string | null {
  const o = (originHeader || "").trim();
  if (!o) return null;
  return ALLOWED_SET.has(o) ? o : null;
}

/**
 * Apply CORS headers using the allow-list. Intended for handlers that set
 * headers manually (legacy `setCors(res)` pattern). When called from a
 * pre-routed onRequest with `cors: ALLOWED_ORIGINS`, the result is idempotent.
 */
export function applyAllowlistedCors(
  req: { header: (n: string) => string | undefined },
  res: { setHeader: (k: string, v: string) => void; removeHeader?: (k: string) => void },
  opts: { methods: string; headers?: string }
): void {
  const allowed = pickAllowedOrigin(req.header("origin"));
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", opts.methods);
    if (opts.headers) res.setHeader("Access-Control-Allow-Headers", opts.headers);
  } else if (res.removeHeader) {
    res.removeHeader("Access-Control-Allow-Origin");
  }
}
