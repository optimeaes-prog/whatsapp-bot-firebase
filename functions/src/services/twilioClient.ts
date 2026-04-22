import axios from "axios";
import { defineString } from "firebase-functions/params";
import { TWILIO_AUTH_TOKEN } from "../secrets";

const TWILIO_ACCOUNT_SID = defineString("TWILIO_ACCOUNT_SID");
const TWILIO_WHATSAPP_NUMBER = defineString("TWILIO_WHATSAPP_NUMBER");
// A6c — alphanumeric sender ID (e.g. "Marcos") used for opt-in SMS to cold Idealista leads.
// Alphanumeric IDs don't accept replies; that's intentional — replies go via the wa.me link.
const TWILIO_SMS_SENDER_ID = defineString("TWILIO_SMS_SENDER_ID");

// Content Template SIDs for initial contact (business-initiated messages)
const TEMPLATE_SID_ES = "HX24e33398987966c0716def76e02d8a04";
const TEMPLATE_SID_EN = "HXf0d964deeae60a41ad1d513069569dc9";

type SendTextParams = {
  to: string;
  body: string;
  chatId?: string;
};

type SendTextResult = {
  chatId: string;
  messageId?: string;
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

function getTwilioCredentials() {
  const accountSid = TWILIO_ACCOUNT_SID.value();
  const authToken = TWILIO_AUTH_TOKEN.value();
  const fromNumber = TWILIO_WHATSAPP_NUMBER.value();

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_WHATSAPP_NUMBER not configured");
  }

  return { accountSid, authToken, fromNumber };
}

function formatWhatsAppNumber(number: string): string {
  return number.startsWith("whatsapp:")
    ? number
    : `whatsapp:+${number.replace(/^\+/, "")}`;
}

/**
 * Send a free-form WhatsApp message via Twilio API
 * Only works within the 24h customer service window
 */
export async function sendText(params: SendTextParams): Promise<SendTextResult> {
  const { accountSid, authToken, fromNumber } = getTwilioCredentials();

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
  };
}

/**
 * A6c — Send a plain SMS (not WhatsApp) via Twilio. Uses the alphanumeric sender ID
 * configured in TWILIO_SMS_SENDER_ID. Spain supports alphanumeric without pre-registration.
 */
export async function sendSms(params: { to: string; body: string }): Promise<{ messageId: string }> {
  const accountSid = TWILIO_ACCOUNT_SID.value();
  const authToken = TWILIO_AUTH_TOKEN.value();
  const senderId = TWILIO_SMS_SENDER_ID.value();
  if (!accountSid || !authToken || !senderId) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_SMS_SENDER_ID not configured");
  }
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
  const { accountSid, authToken, fromNumber } = getTwilioCredentials();

  const toWhatsApp = formatWhatsAppNumber(params.to);
  const fromWhatsApp = formatWhatsAppNumber(fromNumber);

  const templateSid = params.templateSid || (params.language === "en" ? TEMPLATE_SID_EN : TEMPLATE_SID_ES);

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
  return {
    chatId: params.chatId || params.to,
    messageId: data.sid,
  };
}

type CreateContentTemplateParams = {
  friendlyName: string;
  language: "es" | "en";
  /** Sample values for variables, required for WhatsApp approval when using {{1}}, {{2}}, ... */
  variables?: Record<string, string>;
  /** Twilio Content API types payload */
  types: Record<string, unknown>;
};

export async function createContentTemplate(params: CreateContentTemplateParams): Promise<{ contentSid: string }> {
  const { accountSid, authToken } = getTwilioCredentials();

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
  const { accountSid, authToken, fromNumber } = getTwilioCredentials();
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

