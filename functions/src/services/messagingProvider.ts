import {
  sendText as twilioSendText,
  sendTemplate as twilioSendTemplate,
  sendTextWithTemplateFallback as twilioSendTextWithTemplateFallback,
  isLikelyWhatsAppCustomerCareWindowOpenForRecipient,
  twilioContentVariablesForTemplateFallback,
  agentDebugLog,
  phoneSuffixForLog,
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
  /** Twilio ContentSid (ignored by Cloud API). */
  templateSid?: string;
  /** Cloud API template name (ignored by Twilio). */
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
 * Send a WhatsApp message using the configured provider (Twilio or Cloud API).
 */
export async function sendTextMessage(params: SendTextParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();

  console.log(`Sending message via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    return twilioSendText(params);
  }
  return cloudApiSendText(params);
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
 * Send initial contact message using an approved template (Twilio / Cloud API).
 * Required for business-initiated messages outside the 24h customer-care window.
 * Returns the full message text that was sent (for history tracking).
 */
export async function sendInitialTemplateMessage(params: SendTemplateParams): Promise<SendTextResult> {
  const provider = await getActiveProvider();

  console.log(`Sending initial template message via ${provider} to ${params.to}`);

  // A6a/b — enforce opt-in + opt-out for any template-based business-initiated message.
  if (!params.skipEligibilityGate) {
    await assertTemplateSendAllowed({ to: params.to, chatId: params.chatId });
  }

  if (provider === "twilio") {
    return twilioSendTemplate(params);
  }

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

export async function sendAgentNotificationMessage(params: {
  to: string;
  body: string;
  chatId?: string;
  templateSid?: string;
  /** Twilio: optional Content variables (e.g. Proplead {{1}}..{{8}}); when omitted, fallback uses `{ "1": body }`. */
  twilioTemplateVariables?: Record<string, string>;
  /** Cloud API-only: template name used for the 24h-window fallback. */
  cloudApiTemplateName?: string;
  /** Cloud API-only: language for the fallback template. Defaults to "es". */
  cloudApiTemplateLanguage?: "es" | "en";
  context?: string;
}): Promise<SendTextResult> {
  const provider = await getActiveProvider();
  console.log(`Sending agent notification via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    const templateSid = typeof params.templateSid === "string" ? params.templateSid.trim() : "";
    const windowLikelyOpen = await isLikelyWhatsAppCustomerCareWindowOpenForRecipient(params.to);
    // #region agent log
    agentDebugLog({
      hypothesisId: "H0",
      location: "messagingProvider.ts:sendAgentNotificationMessage:twilio",
      message: "sendAgentNotification_twilio_invoke",
      data: {
        toSuffix: phoneSuffixForLog(params.to),
        templateSid,
        bodyLen: String(params.body || "").length,
        context: params.context || "",
        windowLikelyOpen,
        hasMultiVars: !!(params.twilioTemplateVariables && Object.keys(params.twilioTemplateVariables).length > 0),
      },
    });
    // #endregion

    if (windowLikelyOpen) {
      const result = await twilioSendTextWithTemplateFallback({
        to: params.to,
        body: params.body,
        chatId: params.chatId,
        templateSid: params.templateSid,
        templateVariables: params.twilioTemplateVariables,
        context: params.context,
      });
      if (result.usedTemplateFallback) {
        console.log(`Agent notification sent via Twilio template fallback to ${params.to}`);
      }
      return { chatId: result.chatId, messageId: result.messageId };
    }

    if (templateSid) {
      const variables = twilioContentVariablesForTemplateFallback(params.twilioTemplateVariables, params.body);
      // #region agent log
      agentDebugLog({
        hypothesisId: "H7",
        location: "messagingProvider.ts:sendAgentNotificationMessage:twilio_closed_template",
        message: "twilio_closed_window_direct_template",
        data: {
          toSuffix: phoneSuffixForLog(params.to),
          templateSid,
          contentVariableCount: Object.keys(variables).length,
        },
      });
      // #endregion
      const templated = await twilioSendTemplate({
        to: params.to,
        chatId: params.chatId,
        language: "es",
        templateSid,
        variables,
      });
      console.log(`Agent notification sent via Twilio template (closed window) to ${params.to}`);
      return { chatId: templated.chatId, messageId: templated.messageId };
    }

    const result = await twilioSendTextWithTemplateFallback({
      to: params.to,
      body: params.body,
      chatId: params.chatId,
      templateSid: params.templateSid,
      templateVariables: params.twilioTemplateVariables,
      context: params.context,
    });
    if (result.usedTemplateFallback) {
      console.log(`Agent notification sent via Twilio template fallback to ${params.to}`);
    }
    return { chatId: result.chatId, messageId: result.messageId };
  }

  // cloud_api
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

/**
 * Send the returning-lead reconnect message ("You have contacted us again about the property…").
 * Tries free-form text first; on 24h-window rejection, falls back to a static approved template.
 *
 * The template body is static (no `{{1}}` variables) — Twilio ignores unused ContentVariables.
 */
export async function sendReturningLeadMessage(params: {
  to: string;
  body: string;
  chatId?: string;
  /** Twilio Content SID for the static returning-lead template (language-matched). */
  templateSid?: string;
  /** Cloud API template name for the 24h-window fallback (language-matched). */
  cloudApiTemplateName?: string;
  /** Language of the fallback template. */
  language: "es" | "en";
  context?: string;
}): Promise<SendTextResult> {
  const provider = await getActiveProvider();
  console.log(`Sending returning-lead message via ${provider} to ${params.to}`);

  if (provider === "twilio") {
    const result = await twilioSendTextWithTemplateFallback({
      to: params.to,
      body: params.body,
      chatId: params.chatId,
      templateSid: params.templateSid,
      context: params.context || "returning_lead",
    });
    if (result.usedTemplateFallback) {
      console.log(`Returning-lead message sent via Twilio template fallback to ${params.to}`);
    }
    return { chatId: result.chatId, messageId: result.messageId };
  }

  const result = await cloudApiSendTextWithTemplateFallback({
    to: params.to,
    body: params.body,
    chatId: params.chatId,
    templateName: params.cloudApiTemplateName,
    templateLanguage: params.language,
    context: params.context || "returning_lead",
  });
  if (result.usedTemplateFallback) {
    console.log(`Returning-lead message sent via Cloud API template fallback to ${params.to}`);
  }
  return { chatId: result.chatId, messageId: result.messageId };
}
