import crypto from "crypto";
import { REGION } from "../shared";

export function reconstructRequestUrl(req: { headers: Record<string, string | string[] | undefined>; originalUrl: string }): string {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || "https";
  const hostHeader = req.headers["host"];
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return `${proto}://${host}${req.originalUrl}`;
}

export function verifyTwilioSignature(
  authToken: string,
  signatureHeader: string | undefined,
  fullUrl: string,
  body: Record<string, unknown> | undefined
): boolean {
  if (!authToken || !signatureHeader) return false;
  const params = body && typeof body === "object" ? body : {};
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const key of sortedKeys) {
    const value = params[key];
    data += key + (value == null ? "" : String(value));
  }
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Twilio signs each webhook over the EXACT callback URL configured on the
 * sender, which varies across this fleet:
 *   - Some senders point at the Cloud Run URL (https://<svc>.a.run.app) —
 *     Twilio appends "/" and signs that. reconstructRequestUrl reproduces it
 *     because the request hits Cloud Run directly (host = run.app, path = "/").
 *   - Others point at the public function URL
 *     (https://<region>-<project>.cloudfunctions.net/twilioWebhook). Google
 *     proxies that to Cloud Run, rewriting host + stripping the function path,
 *     so reconstructRequestUrl yields the run.app form and can NEVER match the
 *     cloudfunctions.net string Twilio signed.
 * To verify regardless of how the sender was configured, we try the
 * reconstructed URL plus the canonical public function URL.
 */
export function twilioSignedUrlCandidates(req: { headers: Record<string, string | string[] | undefined>; originalUrl: string }): string[] {
  const reconstructed = reconstructRequestUrl(req);
  const canonical = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/twilioWebhook`;
  return Array.from(new Set([reconstructed, canonical]));
}

/** True if the signature matches for ANY of the candidate URLs. */
export function verifyTwilioSignatureAnyUrl(
  authToken: string,
  signatureHeader: string | undefined,
  urls: string[],
  body: Record<string, unknown> | undefined
): boolean {
  return urls.some((u) => verifyTwilioSignature(authToken, signatureHeader, u, body));
}

export function normalizeE164FromTwilio(from: unknown): string {
  const raw = typeof from === "string" ? from.trim() : "";
  if (!raw) return "";
  // Twilio Voice 'From' is like +34911...
  return raw.startsWith("+") ? raw.slice(1) : raw;
}
