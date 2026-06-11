import { OAuth2Client } from "google-auth-library";

// Verifies the OIDC bearer token Cloud Tasks attaches to outbound HTTP tasks
// (see scheduleBufferTask in services/cloudTasks.ts). Cloud Tasks signs a
// short-lived JWT with the configured `oidcToken.serviceAccountEmail`, and
// sets the `aud` claim to the function URL. We require the request to come
// with such a token, with `aud` matching the URL we're hosting at and `iss`
// being a Google identity issuer.
//
// Without this verification, anyone on the internet who knows the function
// URL can invoke processBuffer (and similar Cloud Tasks targets) with
// arbitrary orgId/chatId, burning OpenAI/Twilio credits in any tenant.

const oidcClient = new OAuth2Client();

const ALLOWED_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

type CloudTaskAuthRequest = {
  header: (n: string) => string | undefined;
  hostname?: string;
  originalUrl?: string;
  path?: string;
};

function reconstructUrl(req: CloudTaskAuthRequest): string {
  const proto = (req.header("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host = req.header("host") || req.hostname || "";
  const path = req.originalUrl || req.path || "";
  return `${proto}://${host}${path}`;
}

export async function verifyCloudTasksOidc(
  req: CloudTaskAuthRequest,
  opts?: { expectedAudience?: string; expectedAudiences?: string[] }
): Promise<{ ok: boolean; reason?: string; email?: string }>{
  const auth = req.header("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, reason: "missing_bearer" };
  }
  const token = match[1].trim();
  // Cloud Tasks sets the token's `aud` to the EXACT task URL. When tasks are
  // created with the public cloudfunctions.net URL but delivered to the Gen2
  // function via Cloud Run, the proxy rewrites host + strips the function path,
  // so reconstructUrl(req) yields the run.app form and never matches the
  // cloudfunctions.net `aud`. Accept any supplied audience plus the
  // reconstructed one; verifyIdToken matches if the token's aud equals ANY.
  const candidates = Array.from(
    new Set(
      [
        ...(opts?.expectedAudiences || []),
        ...(opts?.expectedAudience ? [opts.expectedAudience] : []),
        reconstructUrl(req),
      ].filter(Boolean)
    )
  );
  const audience = candidates.length === 1 ? candidates[0] : candidates;
  try {
    const ticket = await oidcClient.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload) return { ok: false, reason: "no_payload" };
    if (!payload.iss || !ALLOWED_ISSUERS.has(payload.iss)) {
      return { ok: false, reason: `bad_iss:${payload.iss || "none"}` };
    }
    if (!payload.email_verified) {
      return { ok: false, reason: "email_not_verified" };
    }
    return { ok: true, email: payload.email };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `verify_failed:${msg.slice(0, 120)}` };
  }
}
