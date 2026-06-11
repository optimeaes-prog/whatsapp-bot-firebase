import axios from "axios";

/**
 * Twilio Verify REST helper.
 *
 * Lives on the MASTER Twilio account (cross-tenant) — not per-org subaccounts —
 * because notification numbers are validated once per org and Verify state isn't
 * partitioned by subaccount in our model. Pair with TWILIO_VERIFY_SERVICE_SID
 * (see `functions/src/secrets.ts`).
 *
 * Uses raw axios to match the project convention established in `twilioClient.ts`
 * (no `twilio` npm SDK).
 */

const VERIFY_BASE = "https://verify.twilio.com/v2";

export type TwilioVerifyChannel = "sms" | "call" | "whatsapp" | "email";

export type VerifyCredentials = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
};

export type VerifyStatus =
  | "pending"
  | "approved"
  | "canceled"
  | "expired"
  | "max_attempts_reached"
  | "deleted"
  | "failed"
  | "unknown";

export type StartVerificationResult = {
  sid: string;
  status: VerifyStatus;
  channel: TwilioVerifyChannel;
};

export type CheckVerificationResult = {
  sid?: string;
  status: VerifyStatus;
  valid: boolean;
};

/**
 * Twilio's Verify error codes we care about explicitly.
 * Full list: https://www.twilio.com/docs/api/errors
 */
const TWILIO_VERIFY_RATE_LIMIT_CODES = new Set<number>([
  20429, // generic rate limit
  60202, // max check attempts reached
  60203, // max send attempts reached
  60410, // verification SID not pending
]);

export function isTwilioVerifyRateLimited(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const code = error.response?.data?.code;
  if (typeof code === "number" && TWILIO_VERIFY_RATE_LIMIT_CODES.has(code)) return true;
  return error.response?.status === 429;
}

export function twilioVerifyErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : String(error);
  }
  const data = error.response?.data as { code?: number; message?: string; more_info?: string } | undefined;
  if (data?.message) {
    return `Twilio Verify ${data.code ?? ""}: ${data.message}`.trim();
  }
  return error.message;
}

function normalizeStatus(raw: unknown): VerifyStatus {
  const s = String(raw || "").toLowerCase();
  if (
    s === "pending" ||
    s === "approved" ||
    s === "canceled" ||
    s === "expired" ||
    s === "max_attempts_reached" ||
    s === "deleted" ||
    s === "failed"
  ) {
    return s as VerifyStatus;
  }
  return "unknown";
}

/**
 * Start a verification: Twilio sends a short code to `to` over the given channel.
 *
 * Returns the verification SID + status. The SID is kept server-side (persisted
 * on the notificationNumbers doc) — never exposed to the client.
 */
export async function startVerification(params: {
  credentials: VerifyCredentials;
  to: string; // E.164
  channel?: TwilioVerifyChannel; // default "sms"
  locale?: string; // e.g. "es"
}): Promise<StartVerificationResult> {
  const { accountSid, authToken, serviceSid } = params.credentials;
  const channel: TwilioVerifyChannel = params.channel || "sms";

  const form = new URLSearchParams({ To: params.to, Channel: channel });
  if (params.locale) form.set("Locale", params.locale);

  const response = await axios.post(
    `${VERIFY_BASE}/Services/${encodeURIComponent(serviceSid)}/Verifications`,
    form.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  const data = response.data as { sid?: string; status?: string; channel?: string };
  if (!data?.sid) {
    throw new Error("Twilio Verify did not return a verification sid");
  }
  return {
    sid: data.sid,
    status: normalizeStatus(data.status),
    channel: (data.channel as TwilioVerifyChannel) || channel,
  };
}

/**
 * Submit a code for verification. `approved` means the user's number is verified;
 * any other status means it isn't (yet).
 *
 * Twilio expects `To` (the E.164 number) — NOT the verification SID — when
 * doing a VerificationCheck.
 */
export async function checkVerification(params: {
  credentials: VerifyCredentials;
  to: string; // E.164
  code: string;
}): Promise<CheckVerificationResult> {
  const { accountSid, authToken, serviceSid } = params.credentials;
  const form = new URLSearchParams({ To: params.to, Code: params.code });

  const response = await axios.post(
    `${VERIFY_BASE}/Services/${encodeURIComponent(serviceSid)}/VerificationCheck`,
    form.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  const data = response.data as { sid?: string; status?: string; valid?: boolean };
  const status = normalizeStatus(data?.status);
  return {
    sid: data?.sid,
    status,
    valid: data?.valid === true || status === "approved",
  };
}
