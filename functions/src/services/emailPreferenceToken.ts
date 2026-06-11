import crypto from "crypto";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBuffer(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Default 90 days. Originally 365 — a year is well beyond any reasonable
// recall window for a "click to unsubscribe" link and lets a leaked token
// stay valid long after the recipient may have left the company / changed
// addresses. Email clients also re-render the most recent email's link when
// the user looks for the unsubscribe, so a 90-day TTL is plenty in practice.
const DEFAULT_EMAIL_PREFS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Signed token: base64url(payloadJson).base64url(hmac)
 * Payload: { e: emailLower, exp: ms epoch }
 */
export function signEmailPrefsToken(email: string, secret: string, ttlMs = DEFAULT_EMAIL_PREFS_TTL_MS): string {
  const e = normalizeEmail(email);
  const payload = JSON.stringify({ e, exp: Date.now() + ttlMs });
  const payloadB64 = base64UrlEncode(Buffer.from(payload, "utf8"));
  const sig = base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

export function verifyEmailPrefsToken(token: string, secret: string): { email: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expectedSig = base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  if (!timingSafeEqualStrings(sig, expectedSig)) return null;
  let payload: { e?: string; exp?: number };
  try {
    payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.e || typeof payload.exp !== "number") return null;
  if (payload.exp < Date.now()) return null;
  return { email: normalizeEmail(payload.e) };
}
