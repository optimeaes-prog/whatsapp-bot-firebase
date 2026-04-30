import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { getActiveOrgId } from "./requestContext";
import type { BotConfig } from "../types";

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
  /** Log context to make traces easier to follow. */
  context?: string;
};

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

function getGcpProjectId(): string {
  const envProject =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  if (envProject) return envProject;
  const appProjectId = admin.app().options.projectId;
  if (appProjectId) return appProjectId;
  throw new Error("Could not determine GCP project ID for Secret Manager access");
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
  try {
    const direct = await sendText(params);
    return { ...direct, usedTemplateFallback: false };
  } catch (error) {
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

    console.warn(
      `[twilio] Outside 24h window for ${params.to}${params.context ? ` (${params.context})` : ""}; ` +
      `retrying with template ${params.templateSid}.`
    );

    const fallback = await sendTemplate({
      to: params.to,
      chatId: params.chatId,
      // Language is ignored when templateSid is provided, but type requires it.
      language: "es",
      templateSid: params.templateSid,
      variables: { "1": params.body },
    });

    return { ...fallback, usedTemplateFallback: true };
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

  const postData: Record<string, string> = {
    From: fromWhatsApp,
    To: toWhatsApp,
    ContentSid: templateSid,
    ContentVariables: JSON.stringify(params.variables),
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

