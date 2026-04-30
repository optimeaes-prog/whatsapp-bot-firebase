import { sendText as whapiSendText } from "./whapiClient";
import {
  sendText as twilioSendText,
  sendTemplate as twilioSendTemplate,
  sendTextWithTemplateFallback as twilioSendTextWithTemplateFallback,
} from "./twilioClient";
import {
  sendText as cloudApiSendText,
  sendReplyButtons as cloudApiSendReplyButtons,
  sendTemplate as cloudApiSendTemplate,
  sendTextWithTemplateFallback as cloudApiSendTextWithTemplateFallback,
  getCloudApiCredentials,
} from "./cloudApiClient";

import type { MessagingProvider } from "../types";

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

type SendTemplateParams = {
  to: string;
  chatId?: string;
  language: "es" | "en";
  variables: Record<string, string>;
  mediaUrl?: string;
  /** Twilio ContentSid (ignored by Cloud API / Whapi). */
  templateSid?: string;
  /** Cloud API template name (ignored by Twilio / Whapi). */
  templateName?: string;
  /**
   * Legacy-only escape hatch to mirror pre-opt-in behavior.
   * When true, skips A6a/b eligibility gate for outbound templates.
   */
  skipEligibilityGate?: boolean;
};

type SendBinaryConfirmPromptParams = {
  to: string;
  chatId?: string;
  language: "es" | "en";
  body: string;
};

import { getActiveOrgId } from "./requestContext";
import { findLeadByChatId, getGlobalMessagingPolicy, getOrganizationMessagingProvider } from "./firestore";
import { normalizeToCanonicalChatId } from "../utils";
import { recordSystemAction } from "./auditService";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

const DATABASE_ID = "realestate-whatsapp-bot";

// Cache providers per organization to support multitenancy
const cachedProviders: Record<string, { provider: MessagingProvider; source: "org" | "global" | "fallback"; expiry: number }> = {};
const CACHE_TTL_MS = 60_000; // 1 minute cache

export function invalidateProviderCache(orgId?: string): void {
  if (orgId) {
    delete cachedProviders[orgId];
    return;
  }
  for (const key of Object.keys(cachedProviders)) {
    delete cachedProviders[key];
  }
}

export async function getEffectiveProviderForOrg(orgId: string): Promise<{
  provider: MessagingProvider;
  source: "org" | "global" | "fallback";
}> {
  const now = Date.now();
  const cached = cachedProviders[orgId];

  if (cached && now < cached.expiry) {
    return { provider: cached.provider, source: cached.source };
  }

  try {
    const orgProvider = await getOrganizationMessagingProvider(orgId);
    if (orgProvider) {
      cachedProviders[orgId] = { provider: orgProvider, source: "org", expiry: now + CACHE_TTL_MS };
      return { provider: orgProvider, source: "org" };
    }

    const globalPolicy = await getGlobalMessagingPolicy();
    const provider = globalPolicy.defaultProvider || "twilio";
    cachedProviders[orgId] = { provider, source: "global", expiry: now + CACHE_TTL_MS };
    return { provider, source: "global" };
  } catch (error) {
    console.warn(`Failed to resolve provider for ${orgId}, defaulting to twilio`, error);
    cachedProviders[orgId] = { provider: "twilio", source: "fallback", expiry: now + CACHE_TTL_MS };
    return { provider: "twilio", source: "fallback" };
  }
}

/**
 * Get the active messaging provider for the current org context.
 */
export async function getActiveProvider(): Promise<MessagingProvider> {
  const orgId = getActiveOrgId();
  const resolved = await getEffectiveProviderForOrg(orgId);
  return resolved.provider;
}

/**
 * A6a/b gate — throws if the lead has not opted in or has opted out.
 *
 * Rules (Cloud API / template-sending path):
 *  1. Opt-out wins: if the chat is in ignoredChats, reject immediately.
 *  2. Opt-in required: the lead must either have a `consent` record OR a prior
 *     inbound message (which auto-creates implicit consent via source
 *     "inbound_whatsapp"). We approximate "prior inbound" by the existence of a
 *     conversation state or chatId on the lead.
 *
 * Error messages are surfaced to the UI so users know to capture consent first.
 */
async function assertTemplateSendAllowed(params: { to: string; chatId?: string }): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) return; // no org context → skip (scripts/tests)
  const db = getFirestore(admin.app(), DATABASE_ID);

  const cfgSnap = await db.doc(`organizations/${orgId}/botConfig/config`).get();
  const blocked = Boolean(cfgSnap.data()?.templateEligibility?.outboundTemplatesBlocked);
  if (blocked) {
    await recordSystemAction(
      "conversation",
      normalizeToCanonicalChatId(params.chatId || params.to),
      "template_send_blocked",
      { reason: "org_blocked", to: params.to }
    );
    throw new Error("No se puede enviar: la organización está bloqueada para plantillas hasta completar readiness.");
  }

  // 1) Opt-out check
  const chatIdCandidates = [
    params.chatId,
    `${params.to.replace(/[^0-9]/g, "")}@s.whatsapp.net`,
    params.to.replace(/[^0-9]/g, ""),
  ].filter(Boolean) as string[];
  for (const cid of chatIdCandidates) {
    const ig = await db.doc(`organizations/${orgId}/ignoredChats/${cid}`).get();
    if (ig.exists) {
      await recordSystemAction("conversation", normalizeToCanonicalChatId(cid), "template_send_blocked", {
        reason: "opt_out",
        to: params.to,
      });
      throw new Error(
        "No se puede enviar: el usuario ha solicitado dejar de recibir mensajes (opt-out)."
      );
    }
  }

  // 2) Opt-in check — prefer chat-linked lead, then phone fallback.
  const phoneDigits = params.to.replace(/[^0-9]/g, "");
  let lead: { consent?: unknown; hasResponse?: boolean } | undefined;
  if (params.chatId) {
    const fromChat = await findLeadByChatId(normalizeToCanonicalChatId(params.chatId));
    if (fromChat) {
      const snap = await db
        .collection(`organizations/${orgId}/leads`)
        .where("chatId", "==", fromChat.chatId)
        .limit(1)
        .get();
      lead = snap.docs[0]?.data() as { consent?: unknown; hasResponse?: boolean } | undefined;
    }
  }
  if (!lead) {
    const leadsRef = db.collection(`organizations/${orgId}/leads`);
    const snap = await leadsRef.where("phone", "==", phoneDigits).limit(1).get();
    lead = snap.docs[0]?.data() as { consent?: unknown; hasResponse?: boolean } | undefined;
  }
  if (!lead) {
    await recordSystemAction("conversation", normalizeToCanonicalChatId(params.chatId || params.to), "template_send_blocked", {
      reason: "missing_lead",
      to: params.to,
    });
    throw new Error(
      "No se puede enviar: no hay un lead con consentimiento registrado para este número."
    );
  }
  const hasConsent = Boolean(lead.consent);
  const hasInbound = Boolean(lead.hasResponse);
  if (!hasConsent && !hasInbound) {
    await recordSystemAction("conversation", normalizeToCanonicalChatId(params.chatId || params.to), "template_send_blocked", {
      reason: "missing_consent",
      to: params.to,
    });
    throw new Error(
      "No se puede enviar: el lead no tiene prueba de consentimiento (opt-in). Registra el consentimiento antes de enviar plantillas."
    );
  }
}

/**
 * Send a WhatsApp message using the configured provider (Whapi, Twilio or Cloud API).
 * For messages within the 24h customer service window or via Whapi (which has no window).
 */
export async function sendTextMessage(params: SendTextParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();

  console.log(`Sending message via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    return twilioSendText(params);
  }
  if (provider === "cloud_api") {
    return cloudApiSendText(params);
  }
  return whapiSendText(params);
}

export async function sendBinaryConfirmPrompt(params: SendBinaryConfirmPromptParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();
  const yesLabel = params.language === "en" ? "Yes" : "Si";
  const noLabel = "No";
  if (provider === "cloud_api") {
    try {
      return await cloudApiSendReplyButtons({
        to: params.to,
        chatId: params.chatId,
        body: params.body,
        yesTitle: yesLabel,
        noTitle: noLabel,
      });
    } catch (error) {
      console.warn("[cloud_api] Failed to send interactive buttons, falling back to text", error);
    }
  }
  return sendTextMessage({
    to: params.to,
    chatId: params.chatId,
    body: params.body,
  });
}

/**
 * Send initial contact message using a template (Twilio / Cloud API) or plain text (Whapi).
 * Twilio and Cloud API require approved templates for business-initiated messages outside the 24h window.
 * Returns the full message text that was sent (for history tracking).
 */
export async function sendInitialTemplateMessage(params: SendTemplateParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();

  console.log(`Sending initial template message via ${provider} to ${params.to}`);

  // A6a/b — enforce opt-in + opt-out for any template-based business-initiated message.
  if ((provider === "cloud_api" || provider === "twilio") && !params.skipEligibilityGate) {
    await assertTemplateSendAllowed({ to: params.to, chatId: params.chatId });
  }

  if (provider === "twilio") {
    return twilioSendTemplate(params);
  }

  if (provider === "cloud_api") {
    if (!params.templateName) {
      throw new Error(
        "sendInitialTemplateMessage: cloud_api requires `templateName` (resolve from botConfig.cloudApiConfig.templates)"
      );
    }
    return cloudApiSendTemplate({
      to: params.to,
      chatId: params.chatId,
      language: params.language,
      variables: params.variables,
      templateName: params.templateName,
      mediaUrl: params.mediaUrl,
    });
  }

  // For Whapi, we just send the composed text as before (no template needed)
  // The caller should handle this by sending regular messages via sendTextMessage
  // This function is only needed for Twilio / Cloud API template flow
  throw new Error("sendInitialTemplateMessage should only be called when Twilio or Cloud API is active");
}

export async function sendAgentNotificationMessage(params: {
  to: string;
  body: string;
  chatId?: string;
  templateSid?: string;
  /** Cloud API-only: template name used for the 24h-window fallback. */
  cloudApiTemplateName?: string;
  /** Cloud API-only: language for the fallback template. Defaults to "es". */
  cloudApiTemplateLanguage?: "es" | "en";
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

  if (provider === "cloud_api") {
    // If no explicit template name was passed, try to resolve the default agent-notification
    // template from the org's cloudApiConfig.templates (keyed by language).
    let templateName = params.cloudApiTemplateName;
    const language = params.cloudApiTemplateLanguage || "es";
    if (!templateName) {
      try {
        const creds = await getCloudApiCredentials();
        templateName =
          creds.templates?.agentNotification ||
          (language === "en"
            ? creds.templates?.agentNotificationEn
            : creds.templates?.agentNotificationEs);
      } catch (error) {
        console.warn("[cloud_api] Could not load templates for agent notification fallback", error);
      }
    }
    const result = await cloudApiSendTextWithTemplateFallback({
      to: params.to,
      body: params.body,
      chatId: params.chatId,
      templateName,
      templateLanguage: language,
      context: params.context,
    });
    if (result.usedTemplateFallback) {
      console.log(`Agent notification sent via Cloud API template fallback to ${params.to}`);
    }
    return { chatId: result.chatId, messageId: result.messageId };
  }

  return whapiSendText({ to: params.to, body: params.body, chatId: params.chatId });
}
