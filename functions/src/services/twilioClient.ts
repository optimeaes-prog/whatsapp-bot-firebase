import { defineString } from "firebase-functions/params";
import axios from "axios";

const TWILIO_ACCOUNT_SID = defineString("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineString("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_NUMBER = defineString("TWILIO_WHATSAPP_NUMBER");

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

type SendTemplateParams = {
  to: string;
  chatId?: string;
  language: "es" | "en";
  variables: Record<string, string>;
  mediaUrl?: string;
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
 * Send a template-based WhatsApp message via Twilio API
 * Used for business-initiated messages (outside the 24h window)
 */
export async function sendTemplate(params: SendTemplateParams): Promise<SendTextResult> {
  const { accountSid, authToken, fromNumber } = getTwilioCredentials();

  const toWhatsApp = formatWhatsAppNumber(params.to);
  const fromWhatsApp = formatWhatsAppNumber(fromNumber);

  const templateSid = params.language === "en" ? TEMPLATE_SID_EN : TEMPLATE_SID_ES;

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
