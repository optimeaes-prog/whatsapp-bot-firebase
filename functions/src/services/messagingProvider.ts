import * as admin from "firebase-admin";
import { sendText as whapiSendText } from "./whapiClient";
import {
  sendText as twilioSendText,
  sendTemplate as twilioSendTemplate,
  sendTextWithTemplateFallback as twilioSendTextWithTemplateFallback,
} from "./twilioClient";

type MessagingProvider = "whapi" | "twilio";

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
  templateSid?: string;
};

import { getFirestore } from "firebase-admin/firestore";
import { getActiveOrgId } from "./requestContext";

const DATABASE_ID = "realestate-whatsapp-bot";

// Cache providers per organization to support multitenancy
const cachedProviders: Record<string, { provider: MessagingProvider; expiry: number }> = {};
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Get the active messaging provider from Firestore (botConfig/config)
 */
export async function getActiveProvider(): Promise<MessagingProvider> {
  const orgId = getActiveOrgId();
  const now = Date.now();
  const cached = cachedProviders[orgId];

  if (cached && now < cached.expiry) {
    return cached.provider;
  }

  try {
    const db = getFirestore(admin.app(), DATABASE_ID);
    const configDoc = await db
      .doc(`organizations/${orgId}/botConfig/config`)
      .get();

    const data = configDoc.data();
    const provider = (data?.messagingProvider as MessagingProvider) || "whapi";

    cachedProviders[orgId] = { provider, expiry: now + CACHE_TTL_MS };

    return provider;
  } catch (error) {
    console.warn(`Failed to read messaging provider config for ${orgId}, defaulting to whapi`, error);
    return "whapi";
  }
}

/**
 * Send a WhatsApp message using the configured provider (Whapi or Twilio)
 * For messages within the 24h customer service window or via Whapi
 */
export async function sendTextMessage(params: SendTextParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();

  console.log(`Sending message via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    return twilioSendText(params);
  }

  return whapiSendText(params);
}

/**
 * Send initial contact message using a template (Twilio) or plain text (Whapi)
 * Twilio requires approved templates for business-initiated messages (outside 24h window)
 * Returns the full message text that was sent (for history tracking)
 */
export async function sendInitialTemplateMessage(params: SendTemplateParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();

  console.log(`Sending initial template message via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    return twilioSendTemplate(params);
  }

  // For Whapi, we just send the composed text as before (no template needed)
  // The caller should handle this by sending regular messages via sendTextMessage
  // This function is only needed for Twilio template flow
  throw new Error("sendInitialTemplateMessage should only be called when Twilio is active");
}

export async function sendAgentNotificationMessage(params: {
  to: string;
  body: string;
  chatId?: string;
  templateSid?: string;
  context?: string;
}): Promise<SendTextResult> {
  const provider = await getActiveProvider();
  console.log(`Sending agent notification via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    const result = await twilioSendTextWithTemplateFallback({
      to: params.to,
      body: params.body,
      chatId: params.chatId,
      templateSid: params.templateSid,
      context: params.context,
    });
    if (result.usedTemplateFallback) {
      console.log(`Agent notification sent via Twilio template fallback to ${params.to}`);
    }
    return { chatId: result.chatId, messageId: result.messageId };
  }

  return whapiSendText({ to: params.to, body: params.body, chatId: params.chatId });
}
