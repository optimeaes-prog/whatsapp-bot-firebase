import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { getActiveOrgId } from "./requestContext";
import type { BotConfig } from "../types";
import { getGcpProjectId } from "../utils/gcpProject";

// #region agent log
const AGENT_DEBUG_SESSION = "64cedb";
const AGENT_DEBUG_ENDPOINT = "http://127.0.0.1:7405/ingest/96d0f620-6747-4d94-83ba-426698967f63";
export function agentDebugLog(payload: Record<string, unknown>): void {
  const body = {
    sessionId: AGENT_DEBUG_SESSION,
    timestamp: Date.now(),
    ...payload,
  };
  fetch(AGENT_DEBUG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": AGENT_DEBUG_SESSION },
    body: JSON.stringify(body),
  }).catch(() => {});
  console.log(`AGENT_DEBUG_JSON ${JSON.stringify(body)}`);
}
export function phoneSuffixForLog(to: string): string {
  const d = String(to || "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : "****";
}
// #endregion

type SendTextParams = {
  to: string;
  body: string;
  chatId?: string;
};

type SendTextResult = {
  chatId: string;
  messageId?: string;
  deliveredText?: string;
};

type CreateVoiceCallParams = {
  to: string;
  from: string;
  url: string;
  statusCallback?: string;
  statusCallbackEvent?: string[];
};

type SendTextWithTemplateFallbackParams = SendTextParams & {
  /** Optional template SID used when Twilio rejects free-form text outside 24h window. */
  templateSid?: string;
  /** When set, template fallback uses these ContentVariables (e.g. Proplead {{1}}..{{8}}). */
  templateVariables?: Record<string, string>;
  /** Log context to make traces easier to follow. */
  context?: string;
};

type TwilioMessageMeta = {
  status?: string;
  errorCode?: number;
  errorMessage?: string;
};

export function twilioContentVariablesForTemplateFallback(
  templateVariables: Record<string, string> | undefined,
  body: string
): Record<string, string> {
  if (templateVariables && Object.keys(templateVariables).length > 0) {
    return normalizeWhatsappContentVariableStrings(templateVariables);
  }
  return normalizeWhatsappContentVariableStrings({ "1": body });
}

async function fetchTwilioMessageMeta(params: {
  accountSid: string;
  authToken: string;
  messageSid: string;
}): Promise<TwilioMessageMeta | undefined> {
  const sid = String(params.messageSid || "").trim();
  if (!sid) return undefined;
  try {
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages/${sid}.json`,
      { auth: { username: params.accountSid, password: params.authToken } }
    );
    const d = response.data as { status?: string; error_code?: number; error_message?: string };
    return {
      status: typeof d.status === "string" ? d.status : undefined,
      errorCode: typeof d.error_code === "number" ? d.error_code : undefined,
      errorMessage: typeof d.error_message === "string" ? d.error_message : undefined,
    };
  } catch {
    return undefined;
  }
}

export function isTwilioOutside24hWindowMeta(meta?: TwilioMessageMeta): boolean {
  if (!meta) return false;
  if (meta.errorCode === 63016) return true;
  const message = (meta.errorMessage || "").toLowerCase();
  return (
    message.includes("outside the allowed window") ||
    message.includes("outside the customer service window") ||
    (message.includes("whatsapp") && message.includes("template"))
  );
}

type SendTemplateParams = {
  to: string;
  chatId?: string;
  language: "es" | "en";
  variables: Record<string, string>;
  mediaUrl?: string;
  /** Optional explicit ContentSid override */
  templateSid?: string;
};

type TwilioResolvedCredentials = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  smsSenderId: string;
};

export const TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_MS = 24 * 60 * 60 * 1000;
// Skew to reduce false-positives near the edge of the window (clock drift / Twilio delays).
export const TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_SKEW_MS = 60 * 1000;

const DATABASE_ID = "realestate-whatsapp-bot";
const CREDENTIALS_CACHE_TTL_MS = 5 * 60 * 1000;
const credentialsCache: Record<string, TwilioResolvedCredentials & { expiry: number }> = {};
let secretManagerClient: SecretManagerServiceClient | null = null;

export function isCustomerCareWindowOpenFromLastInboundMs(lastInboundMs: number, nowMs: number = Date.now()): boolean {
  if (!Number.isFinite(lastInboundMs) || lastInboundMs <= 0) return false;
  if (!Number.isFinite(nowMs) || nowMs <= 0) return false;
  const delta = nowMs - lastInboundMs;
  if (!Number.isFinite(delta) || delta <= 0) return false;
  return delta <= (TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_MS - TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_SKEW_MS);
}

export function normalizeWhatsappContentVariableStrings(variables: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(variables || {})) {
    const raw = String(variables[key] ?? "");
    const normalized = raw
      .replace(/\r?\n+/g, " | ")
      .replace(/\t+/g, " ")
      .replace(/[ ]{5,}/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .trim();
    out[key] = normalized.length > 1600 ? `${normalized.slice(0, 1599)}\u2026` : normalized;
  }
  return out;
}

function getSecretManagerClient(): SecretManagerServiceClient {
  if (!secretManagerClient) secretManagerClient = new SecretManagerServiceClient();
  return secretManagerClient;
}

async function accessSecretVersion(secretName: string): Promise<string> {
  const [version] = await getSecretManagerClient().accessSecretVersion({
    name: `projects/${getGcpProjectId()}/secrets/${secretName}/versions/latest`,
  });
  const payload = version.payload?.data;
  if (!payload) throw new Error(`Secret ${secretName} has no payload`);
  return Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload);
}

async function getTwilioCredentials(orgId?: string): Promise<TwilioResolvedCredentials> {
  const resolvedOrgId = orgId || getActiveOrgId();
  if (!resolvedOrgId) {
    throw new Error("No active orgId in request context; cannot load Twilio credentials");
  }
  const cached = credentialsCache[resolvedOrgId];
  const now = Date.now();
  if (cached && now < cached.expiry) {
    return {
      accountSid: cached.accountSid,
      authToken: cached.authToken,
      fromNumber: cached.fromNumber,
      smsSenderId: cached.smsSenderId,
    };
  }

  const db = getFirestore(admin.app(), DATABASE_ID);
  const cfgSnap = await db.doc(`organizations/${resolvedOrgId}/botConfig/config`).get();
  const cfg = (cfgSnap.data() || {}) as BotConfig;
  const accountSid = cfg.twilioConfig?.accountSid?.trim();
  const fromNumber = cfg.twilioConfig?.whatsappNumber?.trim();
  const smsSenderId = cfg.twilioConfig?.smsSenderId?.trim();
  const authTokenSecretName = cfg.twilioConfig?.authTokenSecretName?.trim();

  if (!accountSid || !fromNumber || !smsSenderId || !authTokenSecretName) {
    throw new Error(
      `Twilio transport config is incomplete for org ${resolvedOrgId} (accountSid, whatsappNumber, smsSenderId, authTokenSecretName)`
    );
  }
  const authToken = (await accessSecretVersion(authTokenSecretName)).trim();
  if (!authToken) {
    throw new Error(`Twilio auth token secret is empty for org ${resolvedOrgId} (${authTokenSecretName})`);
  }
  credentialsCache[resolvedOrgId] = {
    accountSid,
    authToken,
    fromNumber,
    smsSenderId,
    expiry: now + CREDENTIALS_CACHE_TTL_MS,
  };
  return { accountSid, authToken, fromNumber, smsSenderId };
}

const orgAuthTokenCache: Record<string, { token: string; expiry: number }> = {};

/**
 * Auth token of the org's Twilio subaccount, for verifying inbound webhook
 * signatures (Twilio signs with the subaccount token, not the master one).
 * Tolerant on purpose: returns undefined for orgs without a subaccount
 * (legacy orgs on the master account) instead of throwing like
 * getTwilioCredentials, so the webhook can fall back to the master token.
 */
export async function getOrgTwilioAuthToken(orgId: string): Promise<string | undefined> {
  const now = Date.now();
  const cached = orgAuthTokenCache[orgId];
  if (cached && now < cached.expiry) return cached.token;

  const db = getFirestore(admin.app(), DATABASE_ID);
  const cfgSnap = await db.doc(`organizations/${orgId}/botConfig/config`).get();
  const cfg = (cfgSnap.data() || {}) as BotConfig;
  const authTokenSecretName = cfg.twilioConfig?.authTokenSecretName?.trim();
  if (!authTokenSecretName) return undefined;

  try {
    const token = (await accessSecretVersion(authTokenSecretName)).trim();
    if (!token) return undefined;
    orgAuthTokenCache[orgId] = { token, expiry: now + CREDENTIALS_CACHE_TTL_MS };
    return token;
  } catch (error) {
    console.warn(`Could not access Twilio auth token secret for org ${orgId} (${authTokenSecretName})`, error);
    return undefined;
  }
}

function formatWhatsAppNumber(number: string): string {
  return number.startsWith("whatsapp:")
    ? number
    : `whatsapp:+${number.replace(/^\+/, "")}`;
}

function formatE164Number(number: string): string {
  const trimmed = String(number || "").trim();
  if (!trimmed) throw new Error("Phone number is required");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^\+?/, "")}`;
}

/**
 * Send a free-form WhatsApp message via Twilio API
 * Only works within the 24h customer service window
 */
export async function sendText(params: SendTextParams): Promise<SendTextResult> {
  const { accountSid, authToken, fromNumber } = await getTwilioCredentials();

  const toWhatsApp = formatWhatsAppNumber(params.to);
  const fromWhatsApp = formatWhatsAppNumber(fromNumber);

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({
      From: fromWhatsApp,
      To: toWhatsApp,
      Body: params.body,
    }).toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const data = response.data;
  return {
    chatId: params.chatId || params.to,
    messageId: data.sid,
    deliveredText: typeof data.body === "string" ? data.body : params.body,
  };
}

async function fetchTwilioMessageBody(params: {
  accountSid: string;
  authToken: string;
  messageSid?: string;
}): Promise<string | undefined> {
  const sid = typeof params.messageSid === "string" ? params.messageSid.trim() : "";
  if (!sid) return undefined;
  try {
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages/${sid}.json`,
      {
        auth: { username: params.accountSid, password: params.authToken },
      }
    );
    const body = response.data?.body;
    return typeof body === "string" && body.trim() ? body : undefined;
  } catch (error) {
    console.warn("Failed to fetch Twilio message body", error);
    return undefined;
  }
}

/**
 * A6c — Send a plain SMS (not WhatsApp) via Twilio. Uses the alphanumeric sender ID
 * configured in TWILIO_SMS_SENDER_ID. Spain supports alphanumeric without pre-registration.
 */
export async function sendSms(params: { to: string; body: string }): Promise<{ messageId: string }> {
  const { accountSid, authToken, smsSenderId: senderId } = await getTwilioCredentials();
  const to = params.to.startsWith("+") ? params.to : `+${params.to.replace(/^\+?/, "")}`;
  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ From: senderId, To: to, Body: params.body }).toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return { messageId: response.data.sid };
}

function twilioErrorCode(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const code = error.response?.data?.code;
  return typeof code === "number" ? code : undefined;
}

function twilioErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "";
  const message = error.response?.data?.message;
  return typeof message === "string" ? message : "";
}

export function isTwilioOutside24hWindowError(error: unknown): boolean {
  const code = twilioErrorCode(error);
  if (code === 63016) return true;
  const message = twilioErrorMessage(error).toLowerCase();
  return (
    message.includes("outside the allowed window") ||
    message.includes("outside the customer service window") ||
    (message.includes("whatsapp") && message.includes("template"))
  );
}

/**
 * Send text first. If Twilio rejects due to 24h window, retry with a template.
 */
export async function sendTextWithTemplateFallback(
  params: SendTextWithTemplateFallbackParams
): Promise<SendTextResult & { usedTemplateFallback: boolean }> {
  const runTemplateFallback = async (reason: "api_reject" | "deferred_meta"): Promise<SendTextResult & { usedTemplateFallback: boolean }> => {
    if (!params.templateSid) {
      console.warn(
        `[twilio] Outside 24h window for ${params.to}${params.context ? ` (${params.context})` : ""}; ` +
        "TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION is not configured, cannot fallback to template."
      );
      throw new Error("templateSid required for template fallback");
    }

    console.warn(
      `[twilio] Outside 24h window for ${params.to}${params.context ? ` (${params.context})` : ""}; ` +
      `retrying with template ${params.templateSid} (${reason}).`
    );

    const fallbackVars = twilioContentVariablesForTemplateFallback(params.templateVariables, params.body);
    // #region agent log
    agentDebugLog({
      hypothesisId: "H1",
      location: "twilioClient.ts:sendTextWithTemplateFallback:template_fallback",
      message: "twilio_template_fallback_payload",
      data: {
        toSuffix: phoneSuffixForLog(params.to),
        templateSid: String(params.templateSid || "").trim(),
        contentVariableKeys: Object.keys(fallbackVars),
        contentVariableCount: Object.keys(fallbackVars).length,
        reason,
      },
    });
    // #endregion

    const fallback = await sendTemplate({
      to: params.to,
      chatId: params.chatId,
      language: "es",
      templateSid: params.templateSid,
      variables: fallbackVars,
    });

    // #region agent log
    agentDebugLog({
      hypothesisId: "H1",
      location: "twilioClient.ts:sendTextWithTemplateFallback:template_ok",
      message: "twilio_template_fallback_created",
      data: {
        toSuffix: phoneSuffixForLog(params.to),
        messageId: fallback.messageId || "",
        usedTemplateFallback: true,
        reason,
      },
    });
    // #endregion

    return { ...fallback, usedTemplateFallback: true };
  };

  // #region agent log
  agentDebugLog({
    hypothesisId: "H1",
    location: "twilioClient.ts:sendTextWithTemplateFallback:entry",
    message: "twilio_agent_notify_path_start",
    data: {
      toSuffix: phoneSuffixForLog(params.to),
      templateSid: typeof params.templateSid === "string" ? params.templateSid.trim() : "",
      bodyLen: String(params.body || "").length,
      context: params.context || "",
      hasMultiVars: !!(params.templateVariables && Object.keys(params.templateVariables).length > 0),
    },
  });
  // #endregion
  try {
    const direct = await sendText(params);
    const sid = typeof direct.messageId === "string" ? direct.messageId.trim() : "";
    if (sid && params.templateSid) {
      const { accountSid, authToken } = await getTwilioCredentials();
      const meta = await fetchTwilioMessageMeta({ accountSid, authToken, messageSid: sid });
      // #region agent log
      agentDebugLog({
        hypothesisId: "H6",
        location: "twilioClient.ts:sendTextWithTemplateFallback:post_create_meta",
        message: "twilio_direct_message_meta_after_create",
        data: {
          toSuffix: phoneSuffixForLog(params.to),
          messageId: sid,
          metaStatus: meta?.status || "",
          metaErrorCode: meta?.errorCode ?? null,
          outsideWindowMeta: isTwilioOutside24hWindowMeta(meta),
        },
      });
      // #endregion
      if (isTwilioOutside24hWindowMeta(meta)) {
        return runTemplateFallback("deferred_meta");
      }
    }
    // #region agent log
    agentDebugLog({
      hypothesisId: "H2",
      location: "twilioClient.ts:sendTextWithTemplateFallback:direct_ok",
      message: "twilio_direct_session_message_ok",
      data: {
        toSuffix: phoneSuffixForLog(params.to),
        messageId: direct.messageId || "",
        usedTemplateFallback: false,
      },
    });
    // #endregion
    return { ...direct, usedTemplateFallback: false };
  } catch (error) {
    // #region agent log
    agentDebugLog({
      hypothesisId: "H3",
      location: "twilioClient.ts:sendTextWithTemplateFallback:direct_err",
      message: "twilio_direct_session_message_failed",
      data: {
        toSuffix: phoneSuffixForLog(params.to),
        twilioCode: twilioErrorCode(error),
        outsideWindow: isTwilioOutside24hWindowError(error),
      },
    });
    // #endregion
    if (!isTwilioOutside24hWindowError(error)) {
      throw error;
    }

    if (!params.templateSid) {
      console.warn(
        `[twilio] Outside 24h window for ${params.to}${params.context ? ` (${params.context})` : ""}; ` +
        "TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION is not configured, cannot fallback to template."
      );
      throw error;
    }

    return runTemplateFallback("api_reject");
  }
}

/**
 * Send a template-based WhatsApp message via Twilio API
 * Used for business-initiated messages (outside the 24h window)
 */
export async function sendTemplate(params: SendTemplateParams): Promise<SendTextResult> {
  const { accountSid, authToken, fromNumber } = await getTwilioCredentials();

  const toWhatsApp = formatWhatsAppNumber(params.to);
  const fromWhatsApp = formatWhatsAppNumber(fromNumber);

  const templateSid = typeof params.templateSid === "string" ? params.templateSid.trim() : "";
  if (!templateSid) {
    throw new Error("sendTemplate: templateSid is required (per-org Twilio template ownership enforced)");
  }

  const normalizedVariables = normalizeWhatsappContentVariableStrings(params.variables);
  const postData: Record<string, string> = {
    From: fromWhatsApp,
    To: toWhatsApp,
    ContentSid: templateSid,
    ContentVariables: JSON.stringify(normalizedVariables),
  };

  if (params.mediaUrl) {
    postData.MediaUrl = params.mediaUrl;
  }

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams(postData).toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const data = response.data;
  const deliveredFromCreate = typeof data.body === "string" && data.body.trim() ? data.body : undefined;
  const deliveredFromLookup = deliveredFromCreate || await fetchTwilioMessageBody({
    accountSid,
    authToken,
    messageSid: data.sid,
  });
  return {
    chatId: params.chatId || params.to,
    messageId: data.sid,
    deliveredText: deliveredFromLookup,
  };
}

/**
 * Create an outbound Twilio Programmable Voice call.
 */
export async function createVoiceCall(params: CreateVoiceCallParams): Promise<{ callSid: string; status?: string }> {
  const { accountSid, authToken } = await getTwilioCredentials();
  const to = formatE164Number(params.to);
  const from = formatE164Number(params.from);
  const voiceUrl = String(params.url || "").trim();
  if (!voiceUrl) {
    throw new Error("createVoiceCall: url is required");
  }

  const form = new URLSearchParams({
    To: to,
    From: from,
    Url: voiceUrl,
    Method: "POST",
  });
  if (params.statusCallback) {
    form.set("StatusCallback", params.statusCallback);
    form.set("StatusCallbackMethod", "POST");
  }
  if (params.statusCallbackEvent && params.statusCallbackEvent.length > 0) {
    form.set("StatusCallbackEvent", params.statusCallbackEvent.join(" "));
  }

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    form.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const data = response.data as { sid?: string; status?: string };
  if (!data?.sid) {
    throw new Error("createVoiceCall: Twilio did not return call sid");
  }
  return { callSid: data.sid, status: data.status };
}

type CreateContentTemplateParams = {
  friendlyName: string;
  language: "es" | "en";
  /** Sample values for variables, required for WhatsApp approval when using {{1}}, {{2}}, ... */
  variables?: Record<string, string>;
  /** Twilio Content API types payload */
  types: Record<string, unknown>;
  orgId?: string;
};

export async function createContentTemplate(params: CreateContentTemplateParams): Promise<{ contentSid: string }> {
  const { accountSid, authToken } = await getTwilioCredentials(params.orgId);

  const response = await axios.post(
    `https://content.twilio.com/v1/Content`,
    {
      friendly_name: params.friendlyName,
      language: params.language,
      variables: params.variables,
      types: params.types,
    },
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/json" },
    }
  );

  const data = response.data as { sid?: string };
  if (!data?.sid) {
    throw new Error("Twilio Content API did not return sid");
  }
  return { contentSid: data.sid };
}

export type TwilioMessage = {
  sid: string;
  from: string;
  to: string;
  body: string;
  dateSent: string;
  timestamp: number;
  direction: "inbound" | "outbound-api" | "outbound-call";
  status: string;
  chatId: string;
  phone: string;
};

/**
 * True if the recipient likely has an open WhatsApp customer-care window with this org's bot number
 * (last inbound FROM recipient TO bot within ~24h, best-effort via Messages list API).
 */
export async function isLikelyWhatsAppCustomerCareWindowOpenForRecipient(to: string): Promise<boolean> {
  try {
    const { accountSid, authToken, fromNumber } = await getTwilioCredentials();
    const botWhatsApp = formatWhatsAppNumber(fromNumber);
    const fromWhatsApp = formatWhatsAppNumber(to);
    const url =
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json` +
      `?To=${encodeURIComponent(botWhatsApp)}&From=${encodeURIComponent(fromWhatsApp)}&PageSize=1`;
    const response = await axios.get(url, {
      auth: { username: accountSid, password: authToken },
    });
    const messages = (response.data?.messages || []) as Array<{ date_sent?: string; direction?: string }>;
    const m = messages[0];
    if (!m?.date_sent) return false;
    const lastInboundMs = new Date(m.date_sent).getTime();
    return isCustomerCareWindowOpenFromLastInboundMs(lastInboundMs);
  } catch (error) {
    console.warn("Customer-care window preflight failed; treating window as closed", error);
    return false;
  }
}

/**
 * List messages received by the bot within a specific lookback window
 */
export async function listInboundMessages(params: {
  lookbackHours: number;
  maxResults?: number;
}): Promise<TwilioMessage[]> {
  const { accountSid, authToken, fromNumber } = await getTwilioCredentials();
  const botWhatsApp = formatWhatsAppNumber(fromNumber);
  
  const since = new Date(Date.now() - params.lookbackHours * 60 * 60 * 1000);
  const dateSentStr = since.toISOString().split("T")[0]; // YYYY-MM-DD
  
  const allMessages: TwilioMessage[] = [];
  let nextUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(botWhatsApp)}&DateSent>=${dateSentStr}&PageSize=50`;

  while (nextUrl && allMessages.length < (params.maxResults || 200)) {
    const response = await axios.get(nextUrl, {
      auth: { username: accountSid, password: authToken },
    });

    const data = response.data;
    const messages = (data.messages || []) as any[];
    
    for (const m of messages) {
      const sentAt = new Date(m.date_sent);
      if (sentAt < since) continue;
      if (m.direction !== "inbound") continue;

      const phone = m.from.replace(/^whatsapp:/i, "").replace(/^\+/, "").trim();
      const chatId = `${phone}@s.whatsapp.net`;

      allMessages.push({
        sid: m.sid,
        from: m.from,
        to: m.to,
        body: m.body,
        dateSent: m.date_sent,
        timestamp: sentAt.getTime(),
        direction: m.direction,
        status: m.status,
        chatId: chatId,
        phone: phone,
      });
    }

    if (data.next_page_uri) {
      nextUrl = `https://api.twilio.com${data.next_page_uri}`;
    } else {
      break;
    }
  }

  return allMessages;
}

// ==================== TWILIO SENDER MIGRATION HELPERS ====================
//
// These helpers operate on credentials passed in directly (instead of resolving
// them from the request-scoped org). They're used by the sender-migration flow,
// which talks to a fresh Twilio account whose credentials aren't yet stored in
// Firestore / Secret Manager.

export type TwilioRawCredentials = {
  accountSid: string;
  authToken: string;
};

/**
 * Re-throw an axios error as a regular `Error` with Twilio's `code` and `message`
 * extracted from the response body. Without this, callers see the generic
 * "Request failed with status code 401" instead of e.g. "Twilio 20003
 * Authenticate (https://www.twilio.com/docs/errors/20003) — verify Auth Token".
 */
function rethrowTwilioError(error: unknown, context: string): never {
  const err = error as {
    response?: { status?: number; data?: { code?: number; message?: string; more_info?: string } };
    message?: string;
  };
  if (err?.response?.data?.code || err?.response?.data?.message) {
    const code = err.response.data.code;
    const message = err.response.data.message;
    const moreInfo = err.response.data.more_info;
    const status = err.response.status;
    throw new Error(
      `Twilio ${context} failed (HTTP ${status}, code ${code}): ${message}${moreInfo ? ` — ${moreInfo}` : ""}`
    );
  }
  throw error instanceof Error ? error : new Error(String(error));
}

/**
 * Verify a Twilio account SID + auth token combination is valid by hitting the
 * universal Accounts endpoint. Cheaper + clearer than letting deeper API calls
 * report 401 from a less-obvious endpoint.
 */
export async function verifyTwilioCredentials(creds: TwilioRawCredentials): Promise<void> {
  try {
    await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`,
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { Accept: "application/json" },
      }
    );
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      throw new Error(
        "Twilio Auth Token is invalid for this Account SID. Verify the token in the Twilio Console " +
          "(Account → API keys & tokens), use the LIVE token (not a Test token), and confirm the " +
          "account's home region is US1 (other regions are not currently supported)."
      );
    }
    rethrowTwilioError(error, "credentials verification");
  }
}

export type TwilioContentTemplate = {
  sid: string;
  friendly_name: string;
  language: string;
  variables?: Record<string, string>;
  types?: Record<string, unknown>;
};

export type TwilioWhatsAppSender = {
  sid: string;
  /** WhatsApp phone number in E.164, e.g. "+34623946247". */
  sender_id?: string;
  status?: string;
  webhook?: {
    callback_url?: string;
    callback_method?: string;
    fallback_url?: string;
    fallback_method?: string;
  };
};

export type TwilioApprovalRequest = {
  name?: string;
  category?: string;
  content_type?: string;
  status?: string;
  rejection_reason?: string;
  allow_category_change?: boolean;
};

/**
 * Read all Content templates from a Twilio account (paginated).
 * Used by the migration flow to enumerate the source account's templates.
 */
export async function listAllContentTemplates(
  creds: TwilioRawCredentials,
  options: { pageSize?: number } = {}
): Promise<TwilioContentTemplate[]> {
  const pageSize = Math.max(1, Math.min(options.pageSize || 50, 100));
  const out: TwilioContentTemplate[] = [];
  let nextUrl: string | null = `https://content.twilio.com/v1/Content?PageSize=${pageSize}`;
  try {
    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { Accept: "application/json" },
      });
      const data = response.data as {
        contents?: TwilioContentTemplate[];
        meta?: { next_page_url?: string | null };
      };
      for (const t of data.contents || []) {
        if (t?.sid && t?.friendly_name) out.push(t);
      }
      nextUrl = data.meta?.next_page_url || null;
    }
  } catch (error) {
    rethrowTwilioError(error, "list Content templates");
  }
  return out;
}

/**
 * Fetch a single Content template by SID via the Twilio Content API.
 * Returns the full template shape including `types` (which holds the body).
 * Throws (via rethrowTwilioError) if the template doesn't exist or is unreachable.
 */
export async function fetchContentTemplate(
  contentSid: string,
  orgId?: string
): Promise<TwilioContentTemplate> {
  const { accountSid, authToken } = await getTwilioCredentials(orgId);
  try {
    const response = await axios.get(
      `https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}`,
      {
        auth: { username: accountSid, password: authToken },
        headers: { Accept: "application/json" },
      }
    );
    return response.data as TwilioContentTemplate;
  } catch (error) {
    rethrowTwilioError(error, `fetch Content template ${contentSid}`);
    // unreachable — rethrowTwilioError always throws
    throw error;
  }
}

/**
 * Render the WhatsApp text body of a Twilio Content template, substituting
 * `{{1}}`, `{{2}}`, ... with the provided variable values. Used to mirror in
 * the conversation history exactly what the recipient will see.
 *
 * Twilio templates can have multiple "types" (text, quick-reply, list, etc.).
 * We prefer `twilio/text`. For richer types, we try common text-bearing
 * sub-fields (`body`, `text`). Returns an empty string if none found.
 */
export function renderTwilioTemplateBody(
  template: TwilioContentTemplate,
  variables: Record<string, string> = {}
): string {
  const types = (template?.types || {}) as Record<string, unknown>;
  let body = "";
  const textType = types["twilio/text"] as { body?: string } | undefined;
  if (textType?.body) {
    body = textType.body;
  } else {
    // Walk other types looking for the first string body/text.
    for (const v of Object.values(types)) {
      if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        if (typeof obj.body === "string") { body = obj.body; break; }
        if (typeof obj.text === "string") { body = obj.text; break; }
      }
    }
  }
  if (!body) return "";
  // Substitute {{1}}, {{2}}, ... — preserve missing variables as-is so it's
  // visually obvious in QA if a variable wasn't passed.
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, idx) => {
    const value = variables[String(idx)];
    return value !== undefined ? value : `{{${idx}}}`;
  });
}

/**
 * Create a Content template using raw credentials (no Firestore lookup).
 * Mirrors the existing `createContentTemplate` but accepts the destination
 * account's credentials directly. Used during sender migration.
 */
export async function createContentTemplateWithCreds(
  creds: TwilioRawCredentials,
  params: {
    friendlyName: string;
    language: string;
    variables?: Record<string, string>;
    types: Record<string, unknown>;
  }
): Promise<{ contentSid: string }> {
  try {
    const response = await axios.post(
      `https://content.twilio.com/v1/Content`,
      {
        friendly_name: params.friendlyName,
        language: params.language,
        variables: params.variables,
        types: params.types,
      },
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = response.data as { sid?: string };
    if (!data?.sid) throw new Error("Twilio Content API did not return sid on create");
    return { contentSid: data.sid };
  } catch (error) {
    rethrowTwilioError(error, `create Content template "${params.friendlyName}"`);
  }
}

/**
 * Submit a Twilio Content template for WhatsApp approval.
 *
 * Project convention: `category` is hardcoded to `MARKETING` — we never submit
 * UTILITY or AUTHENTICATION. See memory/project_whatsapp_template_category.md.
 *
 * The template `name` is the WhatsApp template name (separate from Twilio's
 * friendly_name). It must be lowercase, snake_case, max 512 chars. We derive it
 * from the friendly_name by lowercasing and replacing non-alphanumerics with `_`.
 */
export async function submitContentForWhatsAppApproval(
  creds: TwilioRawCredentials,
  params: {
    contentSid: string;
    name: string;
    /** Always "MARKETING" by project convention; argument kept for explicitness. */
    category?: "MARKETING";
    allowCategoryChange?: boolean;
  }
): Promise<TwilioApprovalRequest> {
  const body = {
    name: normalizeWhatsAppTemplateName(params.name),
    category: "MARKETING" as const,
    allow_category_change: params.allowCategoryChange ?? true,
  };
  try {
    const response = await axios.post(
      `https://content.twilio.com/v1/Content/${encodeURIComponent(params.contentSid)}/ApprovalRequests/whatsapp`,
      body,
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { "Content-Type": "application/json" },
      }
    );
    return (response.data || {}) as TwilioApprovalRequest;
  } catch (error) {
    rethrowTwilioError(error, `submit Content ${params.contentSid} for WhatsApp approval`);
  }
}

/**
 * Fetch the current WhatsApp approval state for a Content template.
 * Returns undefined when no approval has ever been requested for the SID.
 */
export async function fetchContentApprovalStatus(
  creds: TwilioRawCredentials,
  contentSid: string
): Promise<TwilioApprovalRequest | undefined> {
  try {
    const response = await axios.get(
      `https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}/ApprovalRequests`,
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { Accept: "application/json" },
      }
    );
    const data = response.data as { whatsapp?: TwilioApprovalRequest };
    return data.whatsapp;
  } catch (error: any) {
    if (error?.response?.status === 404) return undefined;
    throw error;
  }
}

/**
 * List the WhatsApp senders registered on a Twilio account.
 * The migration flow uses this to confirm exactly one sender is present on the
 * new account and to capture its sender SID for webhook configuration.
 */
export async function listWhatsAppSenders(
  creds: TwilioRawCredentials
): Promise<TwilioWhatsAppSender[]> {
  const out: TwilioWhatsAppSender[] = [];
  // `Channel=whatsapp` filter is REQUIRED by Twilio's v2 Channels API — omitting
  // it returns HTTP 400 code 20001 "Missing required parameter Channel".
  let nextUrl: string | null = `https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp&PageSize=50`;
  try {
    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { Accept: "application/json" },
      });
      // Twilio's v2 Senders response has been observed in two shapes depending
      // on Channel type / region: sender_id as a flat string ("whatsapp:+34...")
      // or as a nested object ({ sender: "whatsapp:+34..." }). Parse both.
      const data = response.data as {
        senders?: Array<{
          sid: string;
          sender_id?: string | { sender?: string };
          status?: string;
          configuration?: {
            webhook?: { callback_url?: string; callback_method?: string };
          };
        }>;
        meta?: { next_page_url?: string | null };
      };
      // Diagnostic: log shape on first page when no number is parsed, so the
      // next failure (if any) tells us exactly what Twilio sent.
      if ((data.senders?.length || 0) > 0 && out.length === 0) {
        console.log(
          "twilioMigration.listWhatsAppSenders: first-sender shape",
          JSON.stringify(data.senders![0])
        );
      }
      for (const s of data.senders || []) {
        const rawSender =
          (typeof s.sender_id === "string" ? s.sender_id : s.sender_id?.sender) || "";
        const senderE164 = rawSender.replace(/^whatsapp:/i, "");
        out.push({
          sid: s.sid,
          sender_id: senderE164,
          status: s.status,
          webhook: s.configuration?.webhook,
        });
      }
      nextUrl = data.meta?.next_page_url || null;
    }
  } catch (error) {
    rethrowTwilioError(error, "list WhatsApp senders");
  }
  return out;
}

/**
 * Configure the inbound webhook URL on a WhatsApp sender.
 *
 * Twilio Messaging Channels API:
 *   POST /v2/Channels/Senders/{senderSid}
 *   body: { configuration: { webhook: { callback_url, callback_method } } }
 *
 * Idempotent: if the existing webhook already matches, this is a no-op.
 */
export async function configureWhatsAppSenderWebhook(
  creds: TwilioRawCredentials,
  params: {
    senderSid: string;
    callbackUrl: string;
    /** Twilio defaults to POST; we set it explicitly. */
    callbackMethod?: "POST" | "GET";
    fallbackUrl?: string;
    fallbackMethod?: "POST" | "GET";
  }
): Promise<TwilioWhatsAppSender> {
  const callbackMethod = params.callbackMethod || "POST";
  // Read current state to skip unnecessary writes.
  const senders = await listWhatsAppSenders(creds);
  const current = senders.find((s) => s.sid === params.senderSid);
  if (
    current &&
    current.webhook?.callback_url === params.callbackUrl &&
    (current.webhook?.callback_method || "POST") === callbackMethod
  ) {
    return current;
  }
  // NOTE: Twilio v2 Channels Senders UPDATE expects a FLAT body (no
  // `configuration` wrapper). Wrapping it returns HTTP 400 code 63100
  // "Update request body is empty" because Twilio doesn't recognize the field.
  // The LIST response, confusingly, DOES wrap webhook under `configuration` —
  // hence the asymmetry between request and response parsing here.
  try {
    const response = await axios.post(
      `https://messaging.twilio.com/v2/Channels/Senders/${encodeURIComponent(params.senderSid)}`,
      {
        webhook: {
          callback_url: params.callbackUrl,
          callback_method: callbackMethod,
          ...(params.fallbackUrl
            ? { fallback_url: params.fallbackUrl, fallback_method: params.fallbackMethod || "POST" }
            : {}),
        },
      },
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = response.data as {
      sid: string;
      sender_id?: string | { sender?: string };
      status?: string;
      configuration?: { webhook?: TwilioWhatsAppSender["webhook"] };
      webhook?: TwilioWhatsAppSender["webhook"];
    };
    const rawSender =
      (typeof data.sender_id === "string" ? data.sender_id : data.sender_id?.sender) || "";
    return {
      sid: data.sid,
      sender_id: rawSender.replace(/^whatsapp:/i, ""),
      status: data.status,
      webhook: data.configuration?.webhook || data.webhook,
    };
  } catch (error) {
    rethrowTwilioError(error, "configure WhatsApp sender webhook");
  }
}

/**
 * Normalize a friendly_name into a WhatsApp template `name` (lowercase, snake_case).
 */
export function normalizeWhatsAppTemplateName(friendlyName: string): string {
  return friendlyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

/**
 * Build a stable dedupe key for a template (matches existing cloneTwilioContentTemplates.ts).
 */
export function twilioTemplateDedupeKey(t: { friendly_name: string; language: string }): string {
  return `${t.friendly_name.trim().toLowerCase()}::${t.language.trim().toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Twilio Tech Provider: subaccount + WhatsApp sender provisioning
// ---------------------------------------------------------------------------

export type TwilioSubaccount = {
  sid: string;
  authToken: string;
  friendlyName?: string;
  status?: string;
};

/**
 * Create a Twilio subaccount under the master account. Used during WhatsApp
 * Embedded Signup to isolate each customer's senders + usage from siblings.
 *
 * POST /2010-04-01/Accounts.json
 *   Body: FriendlyName=<friendlyName>
 *   Auth: master AccountSid + master AuthToken
 *
 * Response includes `auth_token` which we MUST capture immediately — Twilio
 * only returns it on the create response; later GETs omit it.
 */
export async function createSubaccount(
  masterCreds: TwilioRawCredentials,
  params: { friendlyName: string }
): Promise<TwilioSubaccount> {
  try {
    const response = await axios.post(
      "https://api.twilio.com/2010-04-01/Accounts.json",
      new URLSearchParams({ FriendlyName: params.friendlyName }).toString(),
      {
        auth: { username: masterCreds.accountSid, password: masterCreds.authToken },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    const data = response.data as {
      sid?: string;
      auth_token?: string;
      friendly_name?: string;
      status?: string;
    };
    if (!data?.sid || !data?.auth_token) {
      throw new Error("Twilio Accounts API did not return sid + auth_token on create");
    }
    return {
      sid: data.sid,
      authToken: data.auth_token,
      friendlyName: data.friendly_name,
      status: data.status,
    };
  } catch (error) {
    rethrowTwilioError(error, `create subaccount "${params.friendlyName}"`);
  }
}

/**
 * Create a WhatsApp sender on a Twilio subaccount, binding it to the WABA the
 * customer just shared via Embedded Signup. This is the core Tech Provider call.
 *
 * POST /v2/Channels/Senders
 *   Body (JSON): {
 *     sender_id: "whatsapp:+<E164>",
 *     configuration: { waba_id: "<META_WABA_ID>" },
 *     webhook: { callback_url, callback_method: "POST" },
 *     profile?: { name, vertical, address?, ... }
 *   }
 *
 * Returns immediately with status=CREATING. Caller must poll until ONLINE.
 */
export async function createWhatsAppSender(
  creds: TwilioRawCredentials,
  params: {
    /** Phone number in E.164 (with leading +), e.g. "+34669354177". */
    senderE164: string;
    wabaId: string;
    callbackUrl: string;
    profileName?: string;
    profileVertical?: string;
  }
): Promise<TwilioWhatsAppSender> {
  const senderId = params.senderE164.startsWith("whatsapp:")
    ? params.senderE164
    : `whatsapp:${params.senderE164.startsWith("+") ? "" : "+"}${params.senderE164}`;
  try {
    const body: Record<string, unknown> = {
      sender_id: senderId,
      configuration: { waba_id: params.wabaId },
      webhook: { callback_url: params.callbackUrl, callback_method: "POST" },
    };
    if (params.profileName || params.profileVertical) {
      body.profile = {
        ...(params.profileName ? { name: params.profileName } : {}),
        ...(params.profileVertical ? { vertical: params.profileVertical } : {}),
      };
    }
    const response = await axios.post(
      "https://messaging.twilio.com/v2/Channels/Senders",
      body,
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = response.data as {
      sid: string;
      sender_id?: string | { sender?: string };
      status?: string;
      configuration?: { webhook?: TwilioWhatsAppSender["webhook"] };
    };
    const rawSender =
      (typeof data.sender_id === "string" ? data.sender_id : data.sender_id?.sender) || "";
    return {
      sid: data.sid,
      sender_id: rawSender.replace(/^whatsapp:/i, ""),
      status: data.status,
      webhook: data.configuration?.webhook,
    };
  } catch (error) {
    rethrowTwilioError(error, `create WhatsApp sender for WABA ${params.wabaId}`);
  }
}

/**
 * Fetch a single sender by SID. Used by the onboarding poller.
 */
export async function getWhatsAppSender(
  creds: TwilioRawCredentials,
  senderSid: string
): Promise<TwilioWhatsAppSender> {
  try {
    const response = await axios.get(
      `https://messaging.twilio.com/v2/Channels/Senders/${encodeURIComponent(senderSid)}`,
      {
        auth: { username: creds.accountSid, password: creds.authToken },
        headers: { Accept: "application/json" },
      }
    );
    const data = response.data as {
      sid: string;
      sender_id?: string | { sender?: string };
      status?: string;
      configuration?: { webhook?: TwilioWhatsAppSender["webhook"] };
    };
    const rawSender =
      (typeof data.sender_id === "string" ? data.sender_id : data.sender_id?.sender) || "";
    return {
      sid: data.sid,
      sender_id: rawSender.replace(/^whatsapp:/i, ""),
      status: data.status,
      webhook: data.configuration?.webhook,
    };
  } catch (error) {
    rethrowTwilioError(error, `get WhatsApp sender ${senderSid}`);
  }
}

/**
 * Poll `getWhatsAppSender` until status reaches ONLINE or a hard-failure
 * terminal state, or `timeoutMs` elapses. Onboarding UX needs this synchronous
 * wait so the user sees a "connected" message instead of "we're working on it".
 *
 * Status semantics observed in production:
 *   CREATING / OFFLINE → transient during Tech Provider provisioning. OFFLINE
 *     appears for a few seconds while Twilio waits for Meta to propagate the
 *     WABA share (post-embedded-signup). It typically resolves to ONLINE on
 *     its own. Treating OFFLINE as terminal here breaks the happy path.
 *   VERIFYING → number verification in progress.
 *   VERIFICATION_FAILED / FAILED → true terminal failures, abort polling.
 *   ONLINE → done.
 */
export async function pollSenderUntilOnline(
  creds: TwilioRawCredentials,
  senderSid: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<TwilioWhatsAppSender> {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const intervalMs = options?.intervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  let last: TwilioWhatsAppSender | null = null;
  while (Date.now() < deadline) {
    last = await getWhatsAppSender(creds, senderSid);
    const status = (last.status || "").toUpperCase();
    if (status === "ONLINE") return last;
    if (status === "VERIFICATION_FAILED" || status === "FAILED") {
      throw new Error(`Twilio sender ${senderSid} reached terminal status ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last || { sid: senderSid, status: "TIMEOUT" };
}

