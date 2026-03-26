import * as admin from "firebase-admin";
import { sendText as whapiSendText } from "./whapiClient";
import { sendText as twilioSendText, sendTemplate as twilioSendTemplate } from "./twilioClient";

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
};

// Cache the provider to avoid reading Firestore on every message
let cachedProvider: MessagingProvider | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Get the active messaging provider from Firestore (botConfig/config)
 */
export async function getActiveProvider(): Promise<MessagingProvider> {
  const now = Date.now();
  if (cachedProvider && now < cacheExpiry) {
    return cachedProvider;
  }

  try {
    const db = admin.firestore();
    const configDoc = await db
      .doc("organizations/org_paco_granados/botConfig/config")
      .get();

    const data = configDoc.data();
    const provider = (data?.messagingProvider as MessagingProvider) || "whapi";

    cachedProvider = provider;
    cacheExpiry = now + CACHE_TTL_MS;

    return provider;
  } catch (error) {
    console.warn("Failed to read messaging provider config, defaulting to whapi", error);
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
