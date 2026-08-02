import crypto from "crypto";

/**
 * Signed tokens for the public "leads sin respuesta" page. Same shape as the
 * email preference tokens (base64url payload + HMAC), but they carry an orgId
 * instead of an email: whoever holds the link sees that org's leads and only
 * that org's leads.
 */

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

/**
 * 7 days. The link is re-minted on every daily reminder, so an agent always has
 * a fresh one; the TTL only limits how long an old message stays useful (and
 * how long a forwarded/leaked link keeps working).
 */
export const INACTIVE_LEADS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Signed token: base64url(payloadJson).base64url(hmac)
 * Payload: { o: orgId, exp: ms epoch }
 */
export function signInactiveLeadsToken(
  orgId: string,
  secret: string,
  ttlMs = INACTIVE_LEADS_TOKEN_TTL_MS
): string {
  const o = orgId.trim();
  if (!o) throw new Error("signInactiveLeadsToken: orgId is required");
  const payload = JSON.stringify({ o, exp: Date.now() + ttlMs });
  const payloadB64 = base64UrlEncode(Buffer.from(payload, "utf8"));
  const sig = base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

export function verifyInactiveLeadsToken(token: string, secret: string): { orgId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expectedSig = base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  if (!timingSafeEqualStrings(sig, expectedSig)) return null;
  let payload: { o?: string; exp?: number };
  try {
    payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.o || typeof payload.o !== "string") return null;
  if (typeof payload.exp !== "number") return null;
  if (payload.exp < Date.now()) return null;
  return { orgId: payload.o };
}
