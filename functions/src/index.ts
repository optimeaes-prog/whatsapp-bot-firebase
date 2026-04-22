import * as admin from "firebase-admin";
import axios from "axios";
import crypto from "crypto";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { sendEmailToUser } from "./services/emailService";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { AuditAction, AuditEntityType, ConversationState, HistoryItem, InboundMessage, LeadRow, LeadSummary, ListingRow, OperationType, PendingItem } from "./types";
import {
  fetchListingByCode,
  fetchListingGlobally,
  listActiveListingsForResolution,
  findLeadByChatId,
  findLeadByPhone,
  updateLeadChatInfo,
  updateLeadStatus,
  createPendingCallLead,
  updateLeadListingByChatId,
  appendConversationRow,
  findOrgIdByChatId,

   getActiveStyle,
   getBotConfig,
   getConversationByChatId,
  getConversationByPhoneAndListing,
  upsertConversation,
  addPendingMessage,
  updateBufferTask,
  getPendingMessagesAndClear,
  getConversationsForFollowUp,
  ignoreChat,
  isChatIgnored,
  getAlertCountSince,
  markLeadAsResponded,
  getResponseRateStats,
  getAllLeadsWithChatId,
  updateLeadAnalysis,
  upsertCallIntent,
  updateCloudApiTemplates,
} from "./services/firestore";
import { sendIdealistaOptInSms } from "./services/smsOptIn";
import { checkWhapiHealth } from "./services/whapiClient";
import {
  sendTextMessage,
  sendInitialTemplateMessage,
  sendAgentNotificationMessage,
  getActiveProvider as getActiveProviderFn,
} from "./services/messagingProvider";
import { createContentTemplate } from "./services/twilioClient";
import {
  checkCloudApiHealth,
  createMessageTemplate as createCloudApiMessageTemplate,
  getCloudApiConfigForOrg,
  getCloudApiCredentials,
  parseCloudApiWebhook,
  invalidateCloudApiCredentialsCache,
  type CreateTemplateComponent,
} from "./services/cloudApiClient";
import {
  classifyConfirmDeny,
  resolveListingWithAgent,
  generateAssistantResponse,
  summarizeLeadDetails,
  extractClientName,
  translateTextToBritishEnglish,
  checkLeadPassesFilters,
} from "./services/openaiClient";
import { scheduleBufferTask, BUFFER_DELAY_SECONDS, REGION } from "./shared";
import { sendAlert, sendHealthReport } from "./services/alertService";
import { isOptOutMessage, applyOptOut } from "./services/optOut";
import { ALERT_CATALOG } from "./services/alertCatalog";
import { syncConversationsWithWhapi, retryFailedMessages, queueFailedMessage } from "./services/conversationSyncService";
import { ADMIN_TEMPLATE_TOKEN, OPENAI_API_KEY, TWILIO_AUTH_TOKEN, WHAPI_TOKEN, STRIPE_PRICE_TOPUP_40_CONVS, SENDGRID_API_KEY, META_APP_ID, META_APP_SECRET, META_FB_LOGIN_CONFIG_ID, META_VERIFY_TOKEN } from "./secrets";
import {
  exchangeCodeForToken,
  registerPhoneNumber,
  subscribeAppToWaba,
  storeAccessTokenInSecretManager,
  persistCloudApiConfigForOrg,
  generateRegistrationPin,
  generateVerifyToken,
  fetchDisplayPhoneNumber,
} from "./services/embeddedSignup";
import {
  addOrgConversations,
  addOrgConversationsForPaymentIntentOnce,
  getOrgAutoRechargeSettingsForApi,
  getOrgConversationBalance,
  getOrgStripeCustomerId,
  mergeOrgStripeBillingFields,
  saveOrgAutoRechargeSettings,
} from "./services/billingService";
import { getAuditLogs as getAuditLogsFromService, recordLeadChange, recordConversationChange, recordListingChange, recordSystemAction } from "./services/auditService";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  extractBillingFromCheckoutSession,
  getConversationPackages,
  constructWebhookEvent,
  createBillingPortalSession as createBillingPortalSessionService,
  previewSubscriptionProration,
  updateExistingSubscription,
} from "./services/stripeService";
import {
  getOrgSubscription,
  setOrgSubscription,
  grantSubscriptionConversations,
  PLAN_BASE_CONVERSATIONS,
  calculateProratedConversations,
} from "./services/subscriptionService";
import type { SubscriptionPlanId } from "./types";
import {
  extractPhoneFromChatId,
  getChatIdVariants,
  ensureTimestampMillis,
  isSpanishPhoneNumber,
  normalizeToCanonicalChatId,
} from "./utils";
import { normalizeForSearch } from "./utils/addressNormalize";
import { getActiveOrgId, requestContext } from "./services/requestContext";
import { sendPaymentFailedNotification, sendWelcomeNotification } from "./services/emailService";
// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Firestore settings must be applied exactly once and before any Firestore use.
// Do it at process startup to avoid "Firestore has already been initialized" errors.
(() => {
  const FIRESTORE_DATABASE_ID = "realestate-whatsapp-bot";
  try {
    getFirestore(admin.app(), FIRESTORE_DATABASE_ID).settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // If another module already configured settings in this process, don't crash the function.
    console.warn("[firestore] settings() already applied or Firestore already used:", e);
  }
})();

// REGION is now imported from ./shared

// Organisation identifier (removed global static getActiveOrgId() for multi-tenancy)
// const getActiveOrgId() = getActiveOrgId(); 

// Config params
const NOTIFICATION_NUMBER = defineString("NOTIFICATION_NUMBER");
const VOICE_AUDIO_1_URL = defineString("VOICE_AUDIO_1_URL");
// A6c — idealista confirm template removed; cold Idealista leads now receive an
// SMS opt-in link (Meta Business Messaging Policy requires prior consent before
// sending a marketing template).
const TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION = defineString("TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION");
const TWILIO_TEMPLATE_SID_CALL_INITIAL_ES = defineString("TWILIO_TEMPLATE_SID_CALL_INITIAL_ES");
// A6d — template sent only after DTMF 1 consent on voiceWebhook.
// No body variables. Create in Twilio Content API and paste the resulting ContentSid here.
const TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT = defineString("TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT");
// Public URL for the second voice prompt (DTMF 1 opt-in). Served from Firebase Hosting.
const VOICE_AUDIO_2_OPTIN_URL = defineString("VOICE_AUDIO_2_OPTIN_URL");

const LEAD_QUALIFIED_MARKER = "[LEAD_CUALIFICADO]";
const LEAD_NOT_INTERESTED_MARKER = "[LEAD_NO_INTERESADO]";

const CALL_PENDING_LISTING_CODE = "__pending__";

const SUBSCRIPTION_BASE_PRICES: Record<string, number> = {
  free: 0,
  plus: 19,
  pro: 69,
  pro_plus: 99,
};

const PLAN_RANKS: Record<string, number> = {
  free: 0,
  plus: 1,
  pro: 2,
  pro_plus: 3,
};

function getAgentNotificationTemplateSid(): string | undefined {
  const sid = TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION.value();
  const normalized = typeof sid === "string" ? sid.trim() : "";
  return normalized || undefined;
}

function buildTwiml(xmlBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${xmlBody}\n</Response>`;
}

async function resolveOrgIdFromToken(authHeader?: string): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  
  const DATABASE_ID = "realestate-whatsapp-bot";
  const userDoc = await getFirestore(admin.app(), DATABASE_ID).collection("users").doc(uid).get();
  const orgId = userDoc.data()?.orgId;
  
  if (!orgId) {
    throw new Error("Organization not found for user");
  }
  return orgId;
}

function twimlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeE164FromTwilio(from: unknown): string {
  const raw = typeof from === "string" ? from.trim() : "";
  if (!raw) return "";
  // Twilio Voice 'From' is like +34911...
  return raw.startsWith("+") ? raw.slice(1) : raw;
}

function extractListingCodeFromText(text: string): string | null {
  const t = text || "";
  // Idealista URL
  const urlMatch = t.match(/idealista\.com\/inmueble\/(\d{6,12})/i);
  if (urlMatch?.[1]) return urlMatch[1];
  // Any long-ish digit group (common idealista ids)
  const digitMatch = t.match(/\b(\d{6,12})\b/);
  return digitMatch?.[1] || null;
}

function extractPriceFromText(text: string): number | undefined {
  const t = (text || "").toLowerCase();
  // 250k / 250 K
  const k = t.match(/\b(\d{2,4})\s*k\b/);
  if (k?.[1]) {
    const value = Number(k[1]) * 1000;
    return Number.isFinite(value) ? value : undefined;
  }
  // 250.000 / 250000 / 250,000
  const n = t.match(/\b(\d{2,3}(?:[.,]\d{3})+|\d{5,7})\b/);
  if (!n?.[1]) return undefined;
  const cleaned = n[1].replace(/[^\d]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

type ListingCandidate = {
  listingCode: string;
  description?: string;
  address?: string;
  price?: string | number;
  link?: string;
};

function isLikelyListingHint(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (extractListingCodeFromText(t)) return true;
  if (extractPriceFromText(t) !== undefined) return true;
  if (t.length >= 4 && /[a-záéíóúñü]/i.test(t)) return true;
  return false;
}

function buildRetryListingLookupMessage(attempt: number): string {
  const header = attempt <= 1
    ? "Vale, aún no lo localizo con esos datos."
    : "Sigo sin localizarlo con seguridad.";
  return compactMessage([
    header,
    "¿Me puedes dar otro dato para encontrarlo?",
    "",
    "Puedes enviar:",
    "1) Número de referencia (9 dígitos, empieza por 1)",
    "2) Calle o zona",
    "3) Precio aproximado",
    "4) O el enlace al anuncio",
  ]);
}

function buildConfirmListingMessage(candidate: ListingCandidate): string {
  return compactMessage([
    "Estupendo, creo que ya lo tengo.",
    candidate.link ? `Link: ${candidate.link}` : "",
    "",
    "¿Es esta la vivienda por la que nos contactas?",
  ]);
}

function buildPickListingMessage(candidates: ListingCandidate[]): string {
  const items = candidates.slice(0, 5).map((c, idx) => {
    const bits = [
      c.description || `Anuncio ${c.listingCode}`,
      c.address ? `(${c.address})` : "",
      c.price ? `- ${c.price}` : "",
      c.link ? `- ${c.link}` : "",
    ].filter(Boolean);
    return `${idx + 1}) ${bits.join(" ")}`.trim();
  });
  return compactMessage([
    "He encontrado varios anuncios que podrían encajar.",
    "¿Cuál es el correcto?",
    "",
    ...items,
    "",
    "Respóndeme con el número (1-5), o pega el enlace/ref.",
    "Si no es ninguno, dime “ninguna” y lo buscamos con otro dato.",
  ]);
}

function parsePickSelection(text: string, max: number): { kind: "number"; index: number } | { kind: "none" } | { kind: "unknown" } {
  const t = (text || "").trim().toLowerCase();
  if (!t) return { kind: "unknown" };
  if (t.includes("ninguna") || t.includes("ninguno") || t.includes("no es") || t === "no") return { kind: "none" };
  const m = t.match(/\b([1-9])\b/);
  if (m?.[1]) {
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < max) return { kind: "number", index: idx };
  }
  return { kind: "unknown" };
}

async function resolveListingFromBufferedText(params: {
  operationType?: OperationType;
  text: string;
}): Promise<
  | { kind: "match"; listing: ListingRow }
  | { kind: "ambiguous"; candidates: ListingRow[] }
  | { kind: "none" }
> {
  const combinedText = params.text || "";
  const directCode = extractListingCodeFromText(combinedText);
  if (directCode) {
    const direct = await fetchListingByCode(directCode);
    if (direct) return { kind: "match", listing: direct };
  }
  const activeListings = await listActiveListingsForResolution({
    operationType: params.operationType,
    limit: 600,
  });
  if (!activeListings.length) return { kind: "none" };

  const decision = await resolveListingWithAgent({
    bufferText: combinedText,
    activeListings,
    operationType: params.operationType,
  });
  console.log("Listing agent decision", {
    kind: decision.kind,
    confidence: decision.confidence,
    reason: decision.reason,
    operationType: params.operationType || "unknown",
    listingCount: activeListings.length,
  });

  if (decision.kind === "match") {
    if (decision.confidence < 0.7) return { kind: "none" };
    const found = await fetchListingByCode(decision.listingCode);
    return found ? { kind: "match", listing: found } : { kind: "none" };
  }

  if (decision.kind === "ambiguous") {
    if (decision.confidence < 0.35) return { kind: "none" };
    const rows = await Promise.all(decision.listingCodes.slice(0, 5).map((code) => fetchListingByCode(code)));
    const candidates = rows.filter((row): row is ListingRow => !!row);
    return candidates.length >= 2 ? { kind: "ambiguous", candidates } : { kind: "none" };
  }

  return { kind: "none" };
}

function buildCallInitialWhatsAppMessageEs(agentName?: string): string {
  const who = agentName ? ` de ${agentName}` : "";
  return [
    `¡Hola! Soy el asistente virtual${who}. Acabamos de hablar por teléfono.`,
    "Para localizar el anuncio, ¿me indicas por favor cuál es?",
    "Me puedes pasar:",
    "1) El número de referencia (9 dígitos, empieza por 1)",
    "2) La calle o zona",
    "3) El precio",
    "4) O pegar directamente el enlace al anuncio",
  ].join("\n\n");
}

function buildListingNotFoundFallback(agentName?: string): string {
  const who = agentName ? ` a ${agentName}` : "";
  return `Vale, parece que no lo encuentro en mi sistema, pero no te preocupes. Le enviaré tu contacto${who} para que te llame lo antes posible.`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractStripeId(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  return typeof rec.id === "string" ? rec.id : "";
}

const BULLET_SYMBOL = "•";
const NO_DATA_LABEL = "Sin datos";
const SUMMARY_EMPTY_TOKENS = new Set(["SINDATOS", "NODATOS", "UNKNOWN", "NA", "N/A", "NOINFO", "NOHAYDATOS"]);

async function getFeaturesForLanguage(features: string, language: InitialLanguage): Promise<string> {
  if (language !== "en") return features;
  try {
    return await translateTextToBritishEnglish(features);
  } catch (error) {
    console.warn("Failed to translate features", error);
    return features;
  }
}

type InitialLanguage = "es" | "en";

// In-memory conversation state (for active conversations)
const conversationStates = new Map<string, ConversationState>();

// Initial language resolving
function resolveInitialLanguage(phone?: string): InitialLanguage {
  return isSpanishPhoneNumber(phone) ? "es" : "en";
}

function cleanFeature(line: string): string {
  return line.replace(/^[\u2022•*-]+\s*/u, "").trim();
}

function splitByCommaOutsideParentheses(text: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let buffer = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      const segment = buffer.trim();
      if (segment) segments.push(segment);
      buffer = "";
      continue;
    }
    buffer += char;
  }
  const finalSegment = buffer.trim();
  if (finalSegment) segments.push(finalSegment);
  return segments;
}

function splitFeatures(features: string): string[] {
  const normalized = features.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const newlineSplit = normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (newlineSplit.length > 1) return newlineSplit;
  const semicolonSplit = normalized.split(/;\s*/).map((s) => s.trim()).filter(Boolean);
  if (semicolonSplit.length > 1) return semicolonSplit;
  const commaSplit = splitByCommaOutsideParentheses(normalized);
  if (commaSplit.length > 1) return commaSplit;
  return [normalized];
}

function sanitizeSummaryValue(value?: string | number | boolean): string | number | boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\s+/g, "").toUpperCase();
  if (SUMMARY_EMPTY_TOKENS.has(normalized)) return undefined;
  return trimmed;
}

function pickSummaryValue<T extends string | number | boolean>(...candidates: (T | undefined)[]): T | undefined {
  for (const candidate of candidates) {
    const sanitized = sanitizeSummaryValue(candidate);
    if (sanitized !== undefined) return sanitized as T;
  }
  return undefined;
}

function buildQualifiedLeadMessage(state: ConversationState, summary?: LeadSummary): string {
  const lines = ["Lead cualificado ✅", `Teléfono: ${state.phone}`];
  const resolvedName = pickSummaryValue(summary?.name, state.name);
  lines.push(`Nombre: ${resolvedName ?? NO_DATA_LABEL}`);
  if (state.description) lines.push(`Propiedad: ${state.description}`);
  lines.push(`Operación: ${state.operationType}`);

  if (state.operationType === "Alquiler") {
    lines.push(`Personas: ${pickSummaryValue(summary?.people) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.income) !== undefined ? pickSummaryValue(summary?.income) + " €/mes" : NO_DATA_LABEL}`);
    
    const petsVal = pickSummaryValue(summary?.pets);
    lines.push(`Mascotas: ${petsVal === true ? "Sí" : petsVal === false ? "No" : NO_DATA_LABEL}`);
    
    lines.push(`Fechas: ${pickSummaryValue(summary?.dates) ?? NO_DATA_LABEL}`);
  } else {
    lines.push(`Forma de pago: ${pickSummaryValue(summary?.paymentMethod) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.income) !== undefined ? pickSummaryValue(summary?.income) + " €/mes" : NO_DATA_LABEL}`);
  }

  lines.push(`Disponibilidad visita: ${pickSummaryValue(summary?.visitAvailability) ?? NO_DATA_LABEL}`);
  const notesValue = pickSummaryValue(summary?.notes);
  if (notesValue) lines.push(`Notas: ${notesValue}`);

  return lines.join("\n");
}

function formatFeaturesList(features: string, language: InitialLanguage): string {
  const items = splitFeatures(features).map(cleanFeature).filter(Boolean);
  if (items.length === 0) {
    if (!features.trim()) {
      return language === "en"
        ? `${BULLET_SYMBOL} Property details are not available at the moment`
        : `${BULLET_SYMBOL} Información no disponible por el momento`;
    }
    const fallback = cleanFeature(features);
    return fallback ? `${BULLET_SYMBOL} ${fallback}` : "";
  }
  return items.map((item) => `${BULLET_SYMBOL} ${item}`).join("\n");
}

function compactMessage(lines: string[]): string {
  const normalized: string[] = [];
  for (const line of lines) {
    if (line === "" && normalized[normalized.length - 1] === "") continue;
    normalized.push(line);
  }
  while (normalized[0] === "") normalized.shift();
  while (normalized[normalized.length - 1] === "") normalized.pop();
  return normalized.join("\n");
}

function composeInitialMessages(
  operationType: OperationType,
  link: string,
  features: string,
  options?: { language?: InitialLanguage }
): string[] {
  const language = options?.language ?? "es";
  const isSale = operationType === "Venta";
  const formattedFeatures = formatFeaturesList(features, language);

  if (language === "en") {
    const propertyContext = isSale ? "for sale" : "for rent";
    const message = compactMessage([
      "Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.",
      "",
      `You've shown interest in this property ${propertyContext} 👇`,
      "",
      link,
      "",
      "Just to confirm, have you reviewed the property highlights?",
      "",
      formattedFeatures,
    ]);
    return [message];
  }

  const propertyContext = isSale ? "en venta" : "en alquiler";
  const message = compactMessage([
    "Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.",
    "",
    `Te has interesado en esta vivienda ${propertyContext}👇`,
    "",
    link,
    "",
    "Por confirmar, ¿has visto las características?",
    "",
    formattedFeatures,
  ]);
  return [message];
}

type ParsedAssistantResponse = {
  cleanMessage: string;
  qualificationStatus: boolean | undefined;
};

function parseAssistantResponse(rawMessage: string): ParsedAssistantResponse {
  const trimmed = rawMessage.trim();
  if (trimmed.includes(LEAD_QUALIFIED_MARKER)) {
    return { cleanMessage: trimmed.replace(LEAD_QUALIFIED_MARKER, "").trim(), qualificationStatus: true };
  }
  if (trimmed.includes(LEAD_NOT_INTERESTED_MARKER)) {
    return { cleanMessage: trimmed.replace(LEAD_NOT_INTERESTED_MARKER, "").trim(), qualificationStatus: false };
  }
  return { cleanMessage: trimmed, qualificationStatus: undefined };
}

function extractInboundMessages(body: unknown): InboundMessage[] {
  if (!body || typeof body !== "object") return [];
  const candidate = body as Record<string, unknown>;

  // Check if it's a Twilio payload (form-urlencoded usually results in top-level fields)
  if (candidate.SmsSid && candidate.From && candidate.Body) {
    const from = String(candidate.From);
    const bodyText = String(candidate.Body);
    const waId = candidate.WaId ? String(candidate.WaId) : extractPhoneFromChatId(from);
    
    // Canonical format for Twilio WhatsApp is whatsapp:+123456789
    // We want to normalize it to our internal format 123456789@s.whatsapp.net
    const phone = waId;
    const chatId = normalizeToCanonicalChatId(phone);
    
    const timestampValue = candidate.Timestamp ? Date.parse(String(candidate.Timestamp)) : Date.now();

    return [{
      chatId,
      phone,
      text: bodyText,
      timestamp: ensureTimestampMillis(timestampValue),
    }];
  }

  const messagesField = candidate.messages;
  const rawMessages: unknown[] = Array.isArray(messagesField)
    ? messagesField
    : Array.isArray(candidate.message)
      ? [candidate.message]
      : [];

  const result: InboundMessage[] = [];
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    if (msg.from_me === true) continue;
    const from = typeof msg.from === "string" ? msg.from : typeof msg.sender === "string" ? msg.sender : "";
    const chatId = typeof msg.chat_id === "string" ? msg.chat_id : typeof msg.chatId === "string" ? msg.chatId : "";
    const text =
      typeof msg.text === "string"
        ? msg.text
        : typeof (msg.text as Record<string, unknown>)?.body === "string"
          ? ((msg.text as Record<string, unknown>).body as string)
          : typeof (msg.link_preview as Record<string, unknown>)?.body === "string"
            ? ((msg.link_preview as Record<string, unknown>).body as string)
          : typeof msg.body === "string"
            ? msg.body
            : "";
    const timestampValue = typeof msg.timestamp === "number" ? msg.timestamp : Number.parseInt(msg.timestamp as string, 10);
    const timestamp = ensureTimestampMillis(Number.isFinite(timestampValue) ? timestampValue : Date.now());
    if (!chatId || !text) continue;
    result.push({ chatId, phone: from, text, timestamp });
  }
  return result;
}

export async function ensureConversationState(chatId: string, phoneHint?: string): Promise<ConversationState | undefined> {
  // Get all possible chatId variants (handles @c.us vs @s.whatsapp.net)
  const chatIdVariants = getChatIdVariants(chatId);

  // Check in-memory first (try all variants)
  for (const variant of chatIdVariants) {
    const existing = conversationStates.get(variant);
    if (existing) {
      // Also store under the incoming chatId for future lookups
      if (variant !== chatId) conversationStates.set(chatId, existing);
      return existing;
    }
  }

  // Check Firestore (try all variants)
  for (const variant of chatIdVariants) {
    const savedConv = await getConversationByChatId(variant);
    // Essential: only use saved conversation if it's "complete" (has a phone)
    if (savedConv && savedConv.phone) {
      // Migration: Add tags if missing
      if (!savedConv.tags || savedConv.tags.length === 0) {
        if (savedConv.listingCode) {
          savedConv.type = "lead";
          savedConv.tags = ["lead"];
        } else {
          savedConv.type = "non-lead";
          savedConv.tags = ["non-lead"];
        }
      }
      if (!savedConv.language) {
        savedConv.language = resolveInitialLanguage(savedConv.phone);
      }
      conversationStates.set(chatId, savedConv);
      return savedConv;
    }
  }

  // Try to rebuild from lead (try all variants)
  let lead = null;
  for (const variant of chatIdVariants) {
    lead = await findLeadByChatId(variant);
    if (lead) break;
  }
  if (!lead) {
    // Final fallback: Try by raw phone number (best for fragmented IDs)
    const phone = extractPhoneFromChatId(chatId);
    lead = await findLeadByPhone(phone);
  }

  const phone = phoneHint ?? lead?.phone ?? extractPhoneFromChatId(chatId);

  if (!lead) {
    // Treat as non-lead user
    const nonLeadState: ConversationState = {
      phone,
      chatId,
      history: [],
      pendingUserMessages: [],
      isFinished: false,
      botDisabled: false,
      type: "non-lead",
      tags: ["non-lead"],
      language: resolveInitialLanguage(phone),
    };
    conversationStates.set(chatId, nonLeadState);
    return nonLeadState;
  }

  // Special case: lead exists but listing is not resolved yet (call→WhatsApp handoff)
  if (lead.listingCode === CALL_PENDING_LISTING_CODE) {
    const initialLanguage = resolveInitialLanguage(phone);
    const pendingState: ConversationState = {
      phone,
      listingCode: CALL_PENDING_LISTING_CODE,
      chatId: lead.chatId || chatId,
      operationType: lead.operationType,
      history: [],
      pendingUserMessages: [],
      isFinished: false,
      type: "lead",
      tags: ["lead", "call", "pending-listing"],
      language: initialLanguage,
      botDisabled: false,
      name: lead.name,
    };
    conversationStates.set(chatId, pendingState);
    if (pendingState.chatId !== chatId) conversationStates.set(pendingState.chatId, pendingState);
    return pendingState;
  }

  const listing = await fetchListingByCode(lead.listingCode);
  if (!listing) {
    // If lead exists but listing doesn't, we still treat as non-lead or just return undefined?
    // User said "cuando se reciba un mensaje de un numero que no sea un lead". 
    // If the listing is missing, it's an edge case. Let's treat it as non-lead too but maybe with an alert.
    const errorState: ConversationState = {
      phone,
      chatId: lead.chatId || chatId,
      history: [],
      pendingUserMessages: [],
      isFinished: false,
      botDisabled: false,
      type: "non-lead",
      tags: ["non-lead", "missing-listing"],
      language: resolveInitialLanguage(phone),
    };
    conversationStates.set(chatId, errorState);
    return errorState;
  }

  const initialLanguage = resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listing.features, initialLanguage);
  const initialMessages = composeInitialMessages(listing.operationType, listing.link, featuresText, {
    language: initialLanguage,
  });

  const initialHistory: HistoryItem[] = initialMessages.map((message, index) => ({
    role: "assistant",
    text: message,
    timestamp: Date.now() + index,
  }));

  const state: ConversationState = {
    phone,
    listingCode: listing.listingCode,
    chatId: lead.chatId || chatId, // Use lead's stored chatId as canonical
    operationType: listing.operationType,
    description: listing.description,
    link: listing.link,
    address: listing.address,
    features: featuresText,
    profitabilityReportAvailable: listing.profitabilityReportAvailable,
    profitabilityReport: listing.profitabilityReport,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
    type: "lead",
    tags: ["lead"],
    language: initialLanguage,
    name: lead.name,
  };

  // Cache under both the requested chatId and the canonical one
  conversationStates.set(chatId, state);
  if (state.chatId !== chatId) conversationStates.set(state.chatId, state);
  return state;
}

/**
 * Process multiple buffered messages at once
 * This combines all pending messages into the history before generating a response
 */
async function processBufferedMessages(state: ConversationState, messages: PendingItem[]): Promise<void> {
  if (state.isFinished) {
    console.log("Conversation already finished, ignoring", state.chatId);
    return;
  }

  // If no new messages, we only continue if the last message in history is from user (manual trigger)
  if (messages.length === 0) {
    const lastItem = state.history?.[state.history.length - 1];
    if (!lastItem || lastItem.role !== "user") {
      console.log("No messages to process and last message not from user for", state.chatId);
      return;
    }
    console.log("Manual bot trigger for", state.chatId);
  }

  // Ensure history exists
  if (!state.history) {
    state.history = [];
  }

  // Sort messages by timestamp to maintain order
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  // Add all user messages to history
  for (const msg of sortedMessages) {
    const userHistoryItem: HistoryItem = {
      role: "user",
      text: msg.text,
      timestamp: msg.timestamp,
    };
    state.history.push(userHistoryItem);
  }

  console.log(`Processing ${sortedMessages.length} buffered message(s) for ${state.chatId}`);

  // Mark lead as responded if there are user messages
  if (sortedMessages.length > 0) {
    await markLeadAsResponded(state.chatId);
  }

  // Try to extract client name if not known
  if (!state.name) {
    try {
      const detectedName = await extractClientName(state.history);
      if (detectedName) {
        state.name = detectedName;
        // Update lead with the detected name
        try {
          await updateLeadStatus({
            chatId: state.chatId,
            name: detectedName,
            qualificationStatus: "not_qualified",
          });
        } catch (error) {
          console.warn("Failed to update lead with name", error);
        }
      }
    } catch (error) {
      console.warn("Failed to extract client name", error);
    }
  }

  const applyListingToStateAndPersist = async (listing: ListingRow): Promise<void> => {
    const initialLanguage = state.language || resolveInitialLanguage(state.phone);
    const featuresText = await getFeaturesForLanguage(listing.features, initialLanguage);

    state.listingCode = listing.listingCode;
    state.operationType = listing.operationType;
    state.description = listing.description;
    state.link = listing.link;
    state.address = listing.address;
    state.features = featuresText;
    state.idealistaDescription = listing.idealistaDescription || "";
    state.profitabilityReportAvailable = listing.profitabilityReportAvailable;
    state.profitabilityReport = listing.profitabilityReport;
    state.type = "lead";
    state.tags = Array.from(new Set([...(state.tags || ["lead"]), "lead"]));
    state.language = initialLanguage;

    await upsertConversation(state.chatId, {
      listingCode: listing.listingCode,
      operationType: listing.operationType,
      description: listing.description,
      link: listing.link,
      address: listing.address,
      features: featuresText,
      idealistaDescription: listing.idealistaDescription || "",
      profitabilityReportAvailable: listing.profitabilityReportAvailable,
      profitabilityReport: listing.profitabilityReport,
      tags: state.tags,
      type: "lead",
      language: initialLanguage,
      flowStep: "qualification",
      pendingListingCandidate: undefined,
      pendingListingCandidates: undefined,
      listingResolveAttempts: state.listingResolveAttempts || 0,
    });

    await updateLeadListingByChatId({
      chatId: state.chatId,
      phone: state.phone,
      listingCode: listing.listingCode,
      operationType: listing.operationType,
      name: state.name,
      listingResolutionStatus: "resolved",
      tags: state.tags,
    });

    // Quick qualification toggle: if enabled, notify agent immediately and hand off.
    if (listing.quickQualificationEnabled) {
      const notificationNumberRaw = NOTIFICATION_NUMBER.value();
      const agentNums = notificationNumberRaw
        ? notificationNumberRaw.split(",").map((n) => n.trim()).filter(Boolean)
        : [];
      const agentMsg = compactMessage([
        "Nuevo interés (cualificación rápida).",
        `Nombre: ${state.name || "Sin nombre"}`,
        `Tel: +${state.phone}`,
        `Anuncio: ${listing.description} (ID ${listing.listingCode})`,
        listing.link ? `Link: ${listing.link}` : "",
      ]);
      const templateSid = getAgentNotificationTemplateSid();
      for (const num of agentNums) {
        try {
          await sendAgentNotificationMessage({
            to: num,
            body: agentMsg,
            templateSid,
            context: `quick-qualification:${state.chatId}`,
          });
        } catch (error) {
          console.error("Failed to send quick-qualification notification", error);
        }
      }

      state.isFinished = true;
      state.tags = Array.from(new Set([...(state.tags || []), "needs-human", "quick-qualification"]));
      await updateLeadStatus({
        chatId: state.chatId,
        name: state.name,
        qualificationStatus: "not_qualified",
      });
      await upsertConversation(state.chatId, {
        isFinished: true,
        tags: state.tags,
      });
    }
  };

  // Deterministic call→WhatsApp listing resolution & confirmation before enabling AI flow.
  if (state.listingCode === CALL_PENDING_LISTING_CODE || !state.listingCode) {
    const currentStep = state.flowStep || "call_listing_collect";
    const combinedText = sortedMessages.map((m) => m.text).join("\n");
    const lastUserText = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].text : "";

    const attempt = typeof state.listingResolveAttempts === "number" ? state.listingResolveAttempts : 0;

    const notifyAgentAndClose = async (reason: string, extra?: string) => {
      const notificationNumberRaw = NOTIFICATION_NUMBER.value();
      const agentNums = notificationNumberRaw
        ? notificationNumberRaw.split(",").map((n) => n.trim()).filter(Boolean)
        : [];
      const agentMsg = compactMessage([
        reason,
        `Nombre: ${state.name || "Sin nombre"}`,
        `Tel: +${state.phone}`,
        state.pendingListingCandidate?.listingCode ? `Candidato: ${state.pendingListingCandidate.listingCode}` : "",
        state.pendingListingCandidate?.link ? `Link candidato: ${state.pendingListingCandidate.link}` : "",
        extra ? `Texto: ${extra}` : "",
        `ChatId: ${state.chatId}`,
      ]);
      const templateSid = getAgentNotificationTemplateSid();
      for (const num of agentNums) {
        try {
          await sendAgentNotificationMessage({
            to: num,
            body: agentMsg,
            templateSid,
            context: `call-flow:${state.chatId}`,
          });
        } catch (error) {
          console.error("Failed to notify agent (call flow)", error);
        }
      }
      state.isFinished = true;
      state.tags = Array.from(new Set([...(state.tags || []), "needs-human"]));
      await upsertConversation(state.chatId, { isFinished: true, tags: state.tags, flowStep: "closed" });
    };

    try {
      if (currentStep === "call_listing_pick") {
        const extractedCode = extractListingCodeFromText(lastUserText);
        if (extractedCode) {
          const listing = await fetchListingByCode(extractedCode);
          if (listing) {
            state.pendingListingCandidate = { listingCode: listing.listingCode, link: listing.link, description: listing.description };
            state.pendingListingCandidates = undefined;
            state.flowStep = "call_listing_confirm";
            await upsertConversation(state.chatId, {
              flowStep: "call_listing_confirm",
              pendingListingCandidate: state.pendingListingCandidate,
              pendingListingCandidates: undefined,
              listingResolveAttempts: attempt,
            });
            await sendTextMessage({ to: state.phone, body: buildConfirmListingMessage(state.pendingListingCandidate), chatId: state.chatId });
            return;
          }
        }

        const candidates = state.pendingListingCandidates || [];
        const sel = parsePickSelection(lastUserText, candidates.length);
        if (sel.kind === "number") {
          const picked = candidates[sel.index];
          state.pendingListingCandidate = picked;
          state.pendingListingCandidates = undefined;
          state.flowStep = "call_listing_confirm";
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_confirm",
            pendingListingCandidate: picked,
            pendingListingCandidates: undefined,
            listingResolveAttempts: attempt,
          });
          await sendTextMessage({ to: state.phone, body: buildConfirmListingMessage(picked), chatId: state.chatId });
          return;
        }

        if (sel.kind === "none") {
          const nextAttempt = attempt + 1;
          state.listingResolveAttempts = nextAttempt;
          state.flowStep = "call_listing_collect";
          state.pendingListingCandidates = undefined;
          state.pendingListingCandidate = undefined;
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_collect",
            listingResolveAttempts: nextAttempt,
            pendingListingCandidates: undefined,
            pendingListingCandidate: undefined,
          });
          if (nextAttempt <= 2) {
            await sendTextMessage({ to: state.phone, body: buildRetryListingLookupMessage(nextAttempt), chatId: state.chatId });
            return;
          }
          const fallbackToUser = buildListingNotFoundFallback(undefined);
          await sendTextMessage({ to: state.phone, body: fallbackToUser, chatId: state.chatId });
          await updateLeadListingByChatId({
            chatId: state.chatId,
            phone: state.phone,
            listingCode: CALL_PENDING_LISTING_CODE,
            operationType: state.operationType,
            name: state.name,
            listingResolutionStatus: "failed",
            tags: state.tags,
          });
          await notifyAgentAndClose("Nuevo lead (no se pudo encontrar el anuncio).", combinedText);
          return;
        }

        // Unknown selection → resend list
        if (candidates.length > 0) {
          await sendTextMessage({ to: state.phone, body: buildPickListingMessage(candidates), chatId: state.chatId });
          return;
        }

        state.flowStep = "call_listing_collect";
      }

      if (currentStep === "call_listing_confirm") {
        const candidate = state.pendingListingCandidate;
        if (!candidate?.listingCode) {
          state.flowStep = "call_listing_collect";
          await upsertConversation(state.chatId, { flowStep: "call_listing_collect" });
          return;
        }

        const decision = await classifyConfirmDeny({
          userText: lastUserText,
          promptContext: `Candidato: ${candidate.description || ""} (ID ${candidate.listingCode})\nLink: ${candidate.link || ""}`.trim(),
        });

        if (decision === "confirm") {
          const listing = await fetchListingByCode(candidate.listingCode);
          if (!listing) {
            const nextAttempt = attempt + 1;
            state.listingResolveAttempts = nextAttempt;
            state.flowStep = "call_listing_collect";
            state.pendingListingCandidate = undefined;
            await upsertConversation(state.chatId, {
              flowStep: "call_listing_collect",
              listingResolveAttempts: nextAttempt,
              pendingListingCandidate: undefined,
            });
            await sendTextMessage({ to: state.phone, body: buildRetryListingLookupMessage(nextAttempt), chatId: state.chatId });
            return;
          }

          await applyListingToStateAndPersist(listing);
          if (state.isFinished) return;

          const language = state.language || resolveInitialLanguage(state.phone);
          const formattedFeatures = formatFeaturesList(state.features || "", language);
          const msg = compactMessage([
            "Estupendo, ¡lo tengo!",
            "",
            listing.link || "",
            "",
            "Por confirmar, ¿has visto las características?",
            "",
            formattedFeatures,
          ]);
          await sendTextMessage({ to: state.phone, body: msg, chatId: state.chatId });
          state.flowStep = "qualification";
          await upsertConversation(state.chatId, { flowStep: "qualification" });
          return;
        }

        if (decision === "deny") {
          const fallbackToUser = buildListingNotFoundFallback(undefined);
          await sendTextMessage({ to: state.phone, body: fallbackToUser, chatId: state.chatId });
          await updateLeadListingByChatId({
            chatId: state.chatId,
            phone: state.phone,
            listingCode: CALL_PENDING_LISTING_CODE,
            operationType: state.operationType,
            name: state.name,
            listingResolutionStatus: "failed",
            tags: state.tags,
          });
          await notifyAgentAndClose("Nuevo lead (el usuario indicó que NO es el anuncio).", combinedText);
          return;
        }

        await sendTextMessage({ to: state.phone, body: "¿Me confirmas si es esta vivienda? Si no lo es, dime otro dato o pega el enlace/ref.", chatId: state.chatId });
        return;
      }

      // Default (collect): attempt to resolve listing from buffered text
      if (sortedMessages.length > 0 && isLikelyListingHint(combinedText)) {
        const res = await resolveListingFromBufferedText({
          operationType: state.operationType,
          text: combinedText,
        });

        if (res.kind === "match") {
          const cand: ListingCandidate = {
            listingCode: res.listing.listingCode,
            description: res.listing.description,
            address: res.listing.address || res.listing.street,
            price: res.listing.price,
            link: res.listing.link,
          };
          state.pendingListingCandidate = cand;
          state.pendingListingCandidates = undefined;
          state.flowStep = "call_listing_confirm";
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_confirm",
            pendingListingCandidate: cand,
            pendingListingCandidates: undefined,
            listingResolveAttempts: attempt,
          });
          await sendTextMessage({ to: state.phone, body: buildConfirmListingMessage(cand), chatId: state.chatId });
          return;
        }

        if (res.kind === "ambiguous") {
          const cands: ListingCandidate[] = res.candidates.slice(0, 5).map((l) => ({
            listingCode: l.listingCode,
            description: l.description,
            address: l.address || l.street,
            price: l.price,
            link: l.link,
          }));
          state.pendingListingCandidates = cands;
          state.pendingListingCandidate = undefined;
          state.flowStep = "call_listing_pick";
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_pick",
            pendingListingCandidates: cands,
            pendingListingCandidate: undefined,
            listingResolveAttempts: attempt,
          });
          await sendTextMessage({ to: state.phone, body: buildPickListingMessage(cands), chatId: state.chatId });
          return;
        }

        // none → retry up to 2 times
        const nextAttempt = attempt + 1;
        state.listingResolveAttempts = nextAttempt;
        await upsertConversation(state.chatId, {
          flowStep: "call_listing_collect",
          listingResolveAttempts: nextAttempt,
        });
        if (nextAttempt <= 2) {
          await sendTextMessage({ to: state.phone, body: buildRetryListingLookupMessage(nextAttempt), chatId: state.chatId });
          return;
        }

        const fallbackToUser = buildListingNotFoundFallback(undefined);
        await sendTextMessage({ to: state.phone, body: fallbackToUser, chatId: state.chatId });
        state.tags = Array.from(new Set([...(state.tags || []), "listing-not-found"]));
        await updateLeadListingByChatId({
          chatId: state.chatId,
          phone: state.phone,
          listingCode: CALL_PENDING_LISTING_CODE,
          operationType: state.operationType,
          name: state.name,
          listingResolutionStatus: "failed",
          tags: state.tags,
        });
        await notifyAgentAndClose("Nuevo lead (no se pudo encontrar el anuncio).", combinedText);
        return;
      }
    } catch (error) {
      console.warn("Call listing resolution flow failed", error);
    }
  }

  // Save conversation snapshot with all messages
  await appendConversationRow({
    phone: state.phone,
    chatId: state.chatId,
    listingCode: state.listingCode,
    history: state.history,
    name: state.name,
    qualified: state.qualificationStatus,
    isFinished: state.isFinished,
  });

  // Deterministic step: Idealista confirmation (Si/No) before enabling AI flow.
  if (state.flowStep === "idealista_confirm") {
    const combinedUserText = sortedMessages.map((m) => m.text).join("\n").trim();
    const lastUserText = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].text : "";
    const normalized = normalizeForSearch(lastUserText || "");

    let decision: "confirm" | "deny" | "unclear" = "unclear";
    if (combinedUserText) {
      try {
        decision = await classifyConfirmDeny({
          userText: combinedUserText,
          promptContext: [
            "Paso actual: confirmación inicial tras mensaje de Idealista.",
            "Pregunta esperada al usuario: ¿Es correcto? (Sí/No)",
            `Anuncio actual: ${state.link || "sin_link"}`,
          ].join("\n"),
        });
      } catch (error) {
        console.warn("Failed to classify idealista confirmation, using lexical fallback", error);
      }
    }

    // Safety net when the classifier cannot decide.
    if (decision === "unclear") {
      if (normalized === "si" || normalized === "s" || normalized === "sí" || normalized === "yes") {
        decision = "confirm";
      } else if (normalized === "no" || normalized === "nop") {
        decision = "deny";
      }
    }

    if (decision === "confirm") {
      const language = state.language || resolveInitialLanguage(state.phone);
      const formattedFeatures = formatFeaturesList(state.features || "", language);
      const msg = compactMessage([
        language === "en"
          ? "Great. Have you seen the highlights?"
          : "Estupendo. ¿Has visto las características?",
        formattedFeatures,
      ]);

      try {
        await sendTextMessage({ to: state.phone, body: msg, chatId: state.chatId });
      } catch (error) {
        console.error("Failed to send features after confirm", error);
      }

      state.history.push({ role: "assistant", text: msg, timestamp: Date.now() });
      state.flowStep = "qualification";

      await upsertConversation(state.chatId, {
        history: state.history,
        flowStep: "qualification",
      });
      return;
    }

    if (decision === "deny") {
      const msg = "Perfecto, gracias. Lo dejamos aquí.";
      try {
        await sendTextMessage({ to: state.phone, body: msg, chatId: state.chatId });
      } catch (error) {
        console.error("Failed to send close after NO", error);
      }

      state.history.push({ role: "assistant", text: msg, timestamp: Date.now() });
      state.flowStep = "closed";
      state.isFinished = true;

      await upsertConversation(state.chatId, {
        history: state.history,
        flowStep: "closed",
        isFinished: true,
      });

      try {
        await updateLeadStatus({ chatId: state.chatId, name: state.name, qualificationStatus: "rejected" });
      } catch (error) {
        console.error("Failed to mark lead rejected after NO", error);
      }

      return;
    }

    // Unrecognized response: re-ask succinctly.
    const reprompt = "¿Es correcto? Responde: Si / No";
    try {
      await sendTextMessage({ to: state.phone, body: reprompt, chatId: state.chatId });
    } catch (error) {
      console.error("Failed to reprompt confirm", error);
    }
    state.history.push({ role: "assistant", text: reprompt, timestamp: Date.now() });
    await upsertConversation(state.chatId, { history: state.history });
    return;
  }

  // Non-lead / unknown numbers: never use OpenAI; botDisabled is only for manual agent toggle in Proplead.
  if (state.type === "non-lead") {
    console.log("Non-lead conversation, skipping AI response", state.chatId);
    return;
  }

  // Agent turned off assistant from Proplead
  if (state.botDisabled) {
    console.log("Bot is disabled for this conversation, skipping response generation", state.chatId);
    return;
  }

  // Get active style and generate response
  const style = await getActiveStyle();
  let rawAssistantReply: string;
  try {
    rawAssistantReply = await generateAssistantResponse(state.history, state, style);
  } catch (error) {
    console.error("OpenAI call failed", error);
    return;
  }

  if (!rawAssistantReply.trim()) {
    console.warn("Assistant reply empty, skipping send");
    return;
  }

  // Parse response
  const { cleanMessage, qualificationStatus } = parseAssistantResponse(rawAssistantReply);
  if (!cleanMessage) {
    console.warn("Clean message empty after parsing");
    return;
  }

  // Send message
  try {
    await sendTextMessage({ to: state.phone, body: cleanMessage, chatId: state.chatId });
  } catch (error) {
    console.error("Failed to send message, queuing for retry", error);
    // Queue the failed message for retry
    await queueFailedMessage(
      state.chatId,
      state.phone,
      cleanMessage,
      error instanceof Error ? error.message : String(error)
    );
    // Still add to history so we don't lose the AI's response
    state.history.push({
      role: "assistant",
      text: cleanMessage,
      timestamp: Date.now(),
    });
    // Save the updated history even though send failed
    await appendConversationRow({
      phone: state.phone,
      chatId: state.chatId,
      listingCode: state.listingCode,
      history: state.history,
      name: state.name,
      qualified: state.qualificationStatus,
      isFinished: state.isFinished,
    });
    return;
  }

  // Add assistant response to history
  state.history.push({
    role: "assistant",
    text: cleanMessage,
    timestamp: Date.now(),
  });

  if (qualificationStatus !== undefined) {
    state.qualificationStatus = qualificationStatus;
  }

  // Save updated conversation
  await appendConversationRow({
    phone: state.phone,
    chatId: state.chatId,
    listingCode: state.listingCode,
    history: state.history,
    name: state.name,
    qualified: state.qualificationStatus,
    isFinished: qualificationStatus !== undefined,
  });

  // Handle qualification
  if (qualificationStatus !== undefined) {
    state.isFinished = true;

    if (qualificationStatus) {
      let leadSummary: LeadSummary | undefined;
      try {
        leadSummary = await summarizeLeadDetails(state);
      } catch (error) {
        console.error("Error generating lead summary", error);
      }

      const notificationBody = buildQualifiedLeadMessage(state, leadSummary);

      // Update lead status to qualified — leads is now the single SOT
      try {
        const resolvedName = pickSummaryValue(leadSummary?.name, state.name);
        await updateLeadStatus({
          chatId: state.chatId,
          name: resolvedName,
          qualificationStatus: "qualified",
          pets: leadSummary?.pets,
          income: leadSummary?.income,
          paymentMethod: leadSummary?.paymentMethod,
          notes: leadSummary?.notes,
          conversationSummary: notificationBody,
        });
        console.log("Lead status updated to qualified", state.chatId);
      } catch (error) {
        console.error("Error updating lead status", error);
      }
    } else {
      // Update lead status to rejected (not interested)
      try {
        await updateLeadStatus({
          chatId: state.chatId,
          name: state.name,
          qualificationStatus: "rejected",
        });
        console.log("Lead status updated to rejected", state.chatId);
      } catch (error) {
        console.error("Error updating lead status", error);
      }
    }
  }
}

// ==================== HTTP FUNCTIONS ====================


export const webhook = onRequest(
  { cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN, SENDGRID_API_KEY] },
  async (req, res) => {
  try {
    // Handle GET requests (webhook verification)
    if (req.method === "GET") {
      console.log("Webhook verification request received");
      res.status(200).json({ status: "ok", message: "Webhook is ready" });
      return;
    }

    // Handle POST requests (actual messages)
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    console.log("--- DEBUG WEBHOOK START ---");
    console.log("Method:", req.method);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body Type:", typeof req.body);
    console.log("Body JSON:", JSON.stringify(req.body, null, 2));
    console.log("--- DEBUG WEBHOOK END ---");

    console.log("Webhook POST received", JSON.stringify(req.body, null, 2));

    const inboundMessages = extractInboundMessages(req.body);
    if (inboundMessages.length === 0) {
      console.log("No valid messages found in request");
      res.status(200).json({ received: false, message: "No messages to process" });
      return;
    }

    console.log(`Buffering ${inboundMessages.length} message(s)`);

    // Group messages by chatId
    const messagesByChatId = new Map<string, InboundMessage[]>();
    for (const msg of inboundMessages) {
      const existing = messagesByChatId.get(msg.chatId) || [];
      existing.push(msg);
      messagesByChatId.set(msg.chatId, existing);
    }

    // Process each conversation
    await Promise.all(
      Array.from(messagesByChatId.entries()).map(async ([chatId, messages]) => {
        try {
          // Tiered organization resolution:
          // 1. Explicit query parameter (highest priority)
          // 2. Recency-based lookup (searching all organizations)
          const orgQueryId = req.query.orgId as string | undefined;
          let orgId = orgQueryId || await findOrgIdByChatId(chatId);
          
          if (orgQueryId) {
            console.log(`Using explicit orgId from query: ${orgQueryId} for chatId ${chatId}`);
          } else if (orgId) {
            console.log(`Resolved orgId via recency for chatId ${chatId}: ${orgId}`);
          } else {
            console.warn(`Could not resolve organization for chatId ${chatId}`);
          }

          if (!orgId) {
            console.warn(`Skipping inbound message for ${chatId}: could not resolve orgId`);
            await sendAlert(
              "Inbound message without org",
              "No se pudo resolver la organización para un mensaje entrante. Mensaje no procesado para evitar escritura en tenant incorrecto.",
              { chatId, phone: messages[0]?.phone || "", sampleText: messages[0]?.text || "" }
            );
            return;
          }

          await requestContext.run({ orgId }, async () => {
            // Filter out ignored chats (must run within org context)
            if (await isChatIgnored(chatId)) {
                console.log(`Chat ${chatId} is ignored in org ${orgId}, skipping.`);
                return;
            }

            // Ensure we have a valid conversation state
            const state = await ensureConversationState(chatId, messages[0].phone);
            if (!state) {
              console.warn("Could not reconstruct conversation state", chatId, "in org", orgId);
              await sendAlert("Estado no encontrado", `No se pudo reconstruir el estado para el chat: ${chatId}. Es posible que no haya un lead asociado o los datos del anuncio no existan.`, { chatId, phone: messages[0].phone, orgId });
              return;
            }

            // If conversation is finished, skip buffering
            if (state.isFinished) {
              console.log("Conversation already finished, skipping buffer", chatId);
              return;
            }

            const canonicalChatId = state.chatId;

            // Add messages to pending buffer in Firestore (always using canonical ID)
            for (const msg of messages) {
              await addPendingMessage(canonicalChatId, {
                text: msg.text,
                timestamp: msg.timestamp,
              });
            }

            const processUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/processBuffer`;
            const { taskName, scheduledTime } = await scheduleBufferTask(canonicalChatId, processUrl, state.pendingTaskName, orgId);

            // Update conversation with task info
            await updateBufferTask(canonicalChatId, taskName, scheduledTime);

            console.log(`Buffered ${messages.length} message(s) for ${canonicalChatId} (via ${chatId}), will process at ${new Date(scheduledTime).toISOString()} (Org: ${orgId})`);
          });
        } catch (error) {
          console.error("Error buffering messages for", chatId, error);
          await sendAlert("Webhook Error", `Error al bufferear mensajes para ${chatId}`, {
            error: error instanceof Error ? error.message : String(error),
            chatId
          });
        }
      })
    );

    res.status(200).json({
      received: true,
      buffered: true,
      count: inboundMessages.length,
      bufferDelaySeconds: BUFFER_DELAY_SECONDS,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    await sendAlert("Fatal Webhook Error", "Error crítico en el webhook principal", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}
);

/**
 * Dedicated webhook for Twilio messages
 * Twilio sends form-urlencoded data we can handle in the same logic
 */
export const twilioWebhook = webhook;

/**
 * Dedicated webhook for WhatsApp Cloud API (Meta).
 *
 * URL shape (configured in Meta Business Manager per organization):
 *   https://{region}-{project}.cloudfunctions.net/cloudApiWebhook?orgId={orgId}
 *
 * The `orgId` query parameter is the primary routing mechanism — each WABA is associated 1:1 to an org,
 * so the URL configured in Meta encodes the tenant. We do NOT look up orgs by phone_number_id.
 *
 * GET (verification handshake):
 *   Meta sends ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y. We compare X against the verifyToken
 *   stored in the org's cloudApiConfig, and if it matches, reply with the value of Y as text/plain.
 *
 * POST (inbound messages / statuses):
 *   Body is the Meta webhook JSON. We parse `entry[].changes[].value.messages[]` (text only for now)
 *   and buffer them for processing via the shared pipeline.
 */
export const cloudApiWebhook = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET] },
  async (req, res) => {
    try {
      const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
      if (!orgId) {
        console.warn("cloudApiWebhook received request without orgId query param");
        res.status(400).send("Missing orgId query parameter");
        return;
      }

      // ---- GET: webhook verification handshake ----
      if (req.method === "GET") {
        const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "";
        const verifyToken =
          typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : "";
        const challenge =
          typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";

        if (mode !== "subscribe") {
          res.status(400).send("Invalid hub.mode");
          return;
        }

        try {
          const cfg = await getCloudApiConfigForOrg(orgId);
          if (!cfg.verifyToken || cfg.verifyToken !== verifyToken) {
            console.warn(`cloudApiWebhook verify token mismatch for org ${orgId}`);
            res.status(403).send("Forbidden");
            return;
          }
        } catch (error) {
          console.error(`cloudApiWebhook verification: failed to load config for org ${orgId}`, error);
          res.status(404).send("Org not configured");
          return;
        }

        // Meta expects the challenge value echoed back as plain text.
        res.set("Content-Type", "text/plain");
        res.status(200).send(challenge);
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // ---- Verify X-Hub-Signature-256 against META_APP_SECRET ----
      // Meta signs the raw request body with the app secret (HMAC-SHA256). Reject anything else.
      const signatureHeader = req.header("x-hub-signature-256") || "";
      const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!rawBody || !signatureHeader.startsWith("sha256=")) {
        console.warn(`cloudApiWebhook missing rawBody or signature for org ${orgId}`);
        res.status(401).send("Unauthorized");
        return;
      }
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", META_APP_SECRET.value()).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signatureHeader);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn(`cloudApiWebhook signature mismatch for org ${orgId}`);
        res.status(401).send("Unauthorized");
        return;
      }

      // ---- POST: parse messages and buffer them ----
      console.log("cloudApiWebhook POST received for org", orgId, JSON.stringify(req.body, null, 2));

      const inboundMessages = parseCloudApiWebhook(
        req.body,
        normalizeToCanonicalChatId,
        ensureTimestampMillis
      );

      if (inboundMessages.length === 0) {
        // Meta also posts status updates (delivered/read/etc) — just ack.
        res.status(200).json({ received: true, buffered: false });
        return;
      }

      // Group messages by chatId so multi-message bursts from the same user share a buffer task
      const messagesByChatId = new Map<string, InboundMessage[]>();
      for (const msg of inboundMessages) {
        const existing = messagesByChatId.get(msg.chatId) || [];
        existing.push({ chatId: msg.chatId, phone: msg.phone, text: msg.text, timestamp: msg.timestamp });
        messagesByChatId.set(msg.chatId, existing);
      }

      await requestContext.run({ orgId }, async () => {
        await Promise.all(
          Array.from(messagesByChatId.entries()).map(async ([chatId, messages]) => {
            try {
              if (await isChatIgnored(chatId)) {
                console.log(`Chat ${chatId} is ignored in org ${orgId}, skipping.`);
                return;
              }

              // A6b — STOP/BAJA opt-out: honor consumer-initiated opt-out before buffering.
              if (messages.some((m) => isOptOutMessage(m.text))) {
                await applyOptOut({ orgId, chatId, phone: messages[0].phone });
                console.log(`Chat ${chatId} opted out in org ${orgId}.`);
                return;
              }

              const state = await ensureConversationState(chatId, messages[0].phone);
              if (!state) {
                console.warn("Could not reconstruct conversation state", chatId, "in org", orgId);
                await sendAlert(
                  "Estado no encontrado",
                  `No se pudo reconstruir el estado para el chat: ${chatId}.`,
                  { chatId, phone: messages[0].phone, orgId }
                );
                return;
              }

              if (state.isFinished) {
                console.log("Conversation already finished, skipping buffer", chatId);
                return;
              }

              const canonicalChatId = state.chatId;

              for (const msg of messages) {
                await addPendingMessage(canonicalChatId, {
                  text: msg.text,
                  timestamp: msg.timestamp,
                });
              }

              const processUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/processBuffer`;
              const { taskName, scheduledTime } = await scheduleBufferTask(
                canonicalChatId,
                processUrl,
                state.pendingTaskName,
                orgId
              );

              await updateBufferTask(canonicalChatId, taskName, scheduledTime);

              console.log(
                `[cloud_api] Buffered ${messages.length} message(s) for ${canonicalChatId} (via ${chatId}), ` +
                  `will process at ${new Date(scheduledTime).toISOString()} (Org: ${orgId})`
              );
            } catch (error) {
              console.error("Error buffering Cloud API messages for", chatId, error);
              await sendAlert("Webhook Error", `Error al bufferear mensajes Cloud API para ${chatId}`, {
                error: error instanceof Error ? error.message : String(error),
                chatId,
                orgId,
              });
            }
          })
        );
      });

      res.status(200).json({
        received: true,
        buffered: true,
        count: inboundMessages.length,
        bufferDelaySeconds: BUFFER_DELAY_SECONDS,
      });
    } catch (error) {
      console.error("cloudApiWebhook fatal error:", error);
      await sendAlert("Fatal Webhook Error", "Error crítico en el webhook de Cloud API", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * App-wide WhatsApp Cloud API webhook.
 *
 * Single URL Meta subscribes at the app level (not per-org). No query params.
 * Resolves org by looking up `entry[].id` (= wabaId) in the `wabaIndex` collection,
 * which is populated during Embedded Signup (see persistCloudApiConfigForOrg).
 *
 * GET: verification handshake against the global META_VERIFY_TOKEN secret.
 * POST: verify X-Hub-Signature-256 (HMAC-SHA256 over rawBody with META_APP_SECRET),
 *       then fan out each entry to its owning org and buffer messages.
 */
export const whatsappWebhook = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET, META_VERIFY_TOKEN] },
  async (req, res) => {
    try {
      if (req.method === "GET") {
        const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "";
        const verifyToken =
          typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : "";
        const challenge =
          typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";
        if (mode !== "subscribe" || verifyToken !== META_VERIFY_TOKEN.value()) {
          res.status(403).send("Forbidden");
          return;
        }
        res.set("Content-Type", "text/plain");
        res.status(200).send(challenge);
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const signatureHeader = req.header("x-hub-signature-256") || "";
      const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!rawBody || !signatureHeader.startsWith("sha256=")) {
        res.status(401).send("Unauthorized");
        return;
      }
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", META_APP_SECRET.value()).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signatureHeader);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn("whatsappWebhook signature mismatch");
        res.status(401).send("Unauthorized");
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      const body = req.body as { entry?: Array<{ id?: string }> } | undefined;
      const entries = Array.isArray(body?.entry) ? body!.entry! : [];
      if (entries.length === 0) {
        res.status(200).json({ received: true, buffered: false });
        return;
      }

      // Resolve orgId per entry via wabaIndex/{wabaId}, then reuse per-org buffering path.
      await Promise.all(
        entries.map(async (entry) => {
          const wabaId = entry?.id;
          if (!wabaId) return;
          const idx = await db.doc(`wabaIndex/${wabaId}`).get();
          const orgId = idx.exists ? (idx.data()?.orgId as string | undefined) : undefined;
          if (!orgId) {
            console.warn(`whatsappWebhook: no org mapping for wabaId=${wabaId}`);
            return;
          }

          const inboundMessages = parseCloudApiWebhook(
            { entry: [entry] },
            normalizeToCanonicalChatId,
            ensureTimestampMillis
          );
          if (inboundMessages.length === 0) return;

          const messagesByChatId = new Map<string, InboundMessage[]>();
          for (const msg of inboundMessages) {
            const existing = messagesByChatId.get(msg.chatId) || [];
            existing.push({ chatId: msg.chatId, phone: msg.phone, text: msg.text, timestamp: msg.timestamp });
            messagesByChatId.set(msg.chatId, existing);
          }

          await requestContext.run({ orgId }, async () => {
            await Promise.all(
              Array.from(messagesByChatId.entries()).map(async ([chatId, messages]) => {
                try {
                  if (await isChatIgnored(chatId)) return;
                  if (messages.some((m) => isOptOutMessage(m.text))) {
                    await applyOptOut({ orgId, chatId, phone: messages[0].phone });
                    return;
                  }
                  const state = await ensureConversationState(chatId, messages[0].phone);
                  if (!state) {
                    console.warn("whatsappWebhook: could not reconstruct state for", chatId, "org", orgId);
                    return;
                  }
                  if (state.isFinished) return;
                  const canonicalChatId = state.chatId;
                  for (const msg of messages) {
                    await addPendingMessage(canonicalChatId, { text: msg.text, timestamp: msg.timestamp });
                  }
                  const processUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/processBuffer`;
                  const { taskName, scheduledTime } = await scheduleBufferTask(
                    canonicalChatId,
                    processUrl,
                    state.pendingTaskName,
                    orgId
                  );
                  await updateBufferTask(canonicalChatId, taskName, scheduledTime);
                } catch (err) {
                  console.error("whatsappWebhook buffering error", chatId, err);
                }
              })
            );
          });
        })
      );

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("whatsappWebhook fatal error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Twilio Voice webhook for call→WhatsApp handoff (A6d — DTMF opt-in gate).
 *
 * Configure your Twilio phone number "A CALL COMES IN" to point to this function's URL.
 *
 * Flow:
 * - Play audio1 (existing intro)
 * - <Pause length="3"/>
 * - Play audio2_optin (new prompt: "…pulse 1 o cuelgue…")
 * - <Gather numDigits="1" action=voiceGatherCallback>
 *   - DTMF 1 → consent captured, template sent by voiceGatherCallback
 *   - timeout / hangup → no consent, no template
 */
export const voiceWebhook = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    const body = (req.body && typeof req.body === "object") ? (req.body as Record<string, unknown>) : {};
    const callSid = typeof body.CallSid === "string" ? body.CallSid : "";
    const fromPhone = normalizeE164FromTwilio(body.From);

    if (!fromPhone) {
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Say>Invalid caller.</Say><Hangup/>`));
      return;
    }

    const audio1 = VOICE_AUDIO_1_URL.value();
    const audio2 = VOICE_AUDIO_2_OPTIN_URL.value();
    if (!audio1 || !audio2) {
      console.error("VOICE_AUDIO_1_URL / VOICE_AUDIO_2_OPTIN_URL not configured");
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Say>Audio not configured.</Say><Hangup/>`));
      return;
    }

    const chatId = normalizeToCanonicalChatId(fromPhone);
    const gatherUrl =
      `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/voiceGatherCallback` +
      `?phone=${encodeURIComponent(fromPhone)}&chatId=${encodeURIComponent(chatId)}&callSid=${encodeURIComponent(callSid)}`;

    res.set("Content-Type", "text/xml");
    res.status(200).send(
      buildTwiml(
        [
          `<Play>${twimlEscape(audio1)}</Play>`,
          `<Pause length="3"/>`,
          `<Gather numDigits="1" timeout="6" action="${twimlEscape(gatherUrl)}" method="POST">`,
          `  <Play>${twimlEscape(audio2)}</Play>`,
          `</Gather>`,
          // Fallback: no digit pressed → hang up without sending anything (no consent).
          `<Hangup/>`,
        ].join("\n")
      )
    );

    setImmediate(async () => {
      try {
        if (callSid) {
          await upsertCallIntent({ callSid, fromPhone, capturedName: undefined });
        }
      } catch (error) {
        console.error("voiceWebhook failed upserting call intent", error);
      }
      try {
        await createPendingCallLead({ phone: fromPhone, chatId });
      } catch (error) {
        console.error("voiceWebhook failed creating pending call lead", error);
      }
    });
  } catch (error) {
    console.error("voiceWebhook error", error);
    res.set("Content-Type", "text/xml");
    res.status(200).send(buildTwiml(`<Say>Error.</Say><Hangup/>`));
  }
});

/**
 * Twilio <Gather> callback: if the caller pressed "1", we record explicit consent
 * and send the approved Twilio marketing template. Any other input (or timeout)
 * results in a clean hangup with no message sent.
 *
 * Consent record: { source: "phone_call", proofUrl: callSid, capturedAt: now }.
 */
export const voiceGatherCallback = onRequest(
  { cors: true, region: REGION, secrets: [TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    try {
      const body = (req.body && typeof req.body === "object") ? (req.body as Record<string, unknown>) : {};
      const digits = typeof body.Digits === "string" ? body.Digits.trim() : "";
      const phone =
        (typeof req.query.phone === "string" && req.query.phone) ||
        normalizeE164FromTwilio(body.From) ||
        "";
      const chatId =
        (typeof req.query.chatId === "string" && req.query.chatId) ||
        (phone ? normalizeToCanonicalChatId(phone) : "");
      const callSid =
        (typeof req.query.callSid === "string" && req.query.callSid) ||
        (typeof body.CallSid === "string" ? body.CallSid : "");

      res.set("Content-Type", "text/xml");
      if (digits !== "1" || !phone || !chatId) {
        res.status(200).send(buildTwiml(`<Hangup/>`));
        return;
      }

      // Respond to Twilio immediately so the caller is not kept hanging.
      res.status(200).send(
        buildTwiml(
          `<Say voice="Polly.Lucia-Neural" language="es-ES">Gracias. En breve recibirá un mensaje por WhatsApp.</Say><Hangup/>`
        )
      );

      setImmediate(async () => {
        try {
          // Resolve org from the pending lead created by voiceWebhook.
          const orgId = await findOrgIdByPhone(phone);
          if (!orgId) {
            console.warn("voiceGatherCallback: no org found for phone", phone);
            return;
          }
          await requestContext.run({ orgId }, async () => {
            await recordVoiceConsent({ phone, chatId, callSid });
            const templateSid = TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT.value();
            if (!templateSid) {
              console.error("TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT not set; skipping send");
              return;
            }
            await sendInitialTemplateMessage({
              to: phone,
              chatId,
              language: "es",
              variables: {},
              templateSid,
            });
          });
        } catch (err) {
          console.error("voiceGatherCallback async error:", err);
        }
      });
    } catch (error) {
      console.error("voiceGatherCallback error", error);
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Hangup/>`));
    }
  }
);

/**
 * Find the orgId that owns a pending call lead for this phone (set by voiceWebhook
 * via createPendingCallLead). Scans the pending-call collection across orgs.
 */
async function findOrgIdByPhone(phone: string): Promise<string | null> {
  const DATABASE_ID = "realestate-whatsapp-bot";
  const db = getFirestore(admin.app(), DATABASE_ID);
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const snap = await db
    .collectionGroup("leads")
    .where("phone", "==", phoneDigits)
    .limit(5)
    .get();
  for (const doc of snap.docs) {
    const path = doc.ref.path; // organizations/{orgId}/leads/{leadId}
    const parts = path.split("/");
    if (parts[0] === "organizations" && parts[1]) return parts[1];
  }
  return null;
}

/**
 * Write consent proof on the lead doc after DTMF 1. Idempotent.
 */
async function recordVoiceConsent(params: {
  phone: string;
  chatId: string;
  callSid: string;
}): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) return;
  const DATABASE_ID = "realestate-whatsapp-bot";
  const db = getFirestore(admin.app(), DATABASE_ID);
  const phoneDigits = params.phone.replace(/[^0-9]/g, "");
  const leadsRef = db.collection(`organizations/${orgId}/leads`);
  const snap = await leadsRef.where("phone", "==", phoneDigits).limit(1).get();
  const consent = {
    capturedAt: new Date(),
    source: "phone_call" as const,
    proofUrl: params.callSid || null,
    language: "es" as const,
  };
  if (snap.empty) {
    // Create a minimal lead row so the consent gate finds it.
    await leadsRef.add({
      phone: phoneDigits,
      chatId: params.chatId,
      listingCode: "__pending__",
      operationType: "unknown",
      consent,
    });
    return;
  }
  await snap.docs[0].ref.set({ consent }, { merge: true });
}

/**
 * Cloud Tasks target: sends the post-call WhatsApp message via Whapi (Spanish).
 * Required because voice webhook must respond immediately to avoid awkward pauses/cut audio.
 */
export const sendCallHandoffMessage = onRequest({ cors: true, region: REGION, secrets: [WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";
  const agentName = typeof req.body?.agentName === "string" ? req.body.agentName.trim() : "Paco Granados";

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const resolvedChatId = chatId || normalizeToCanonicalChatId(phone);

  try {
    const orgId = await findOrgIdByChatId(resolvedChatId);
    if (!orgId) {
      console.error("sendCallHandoffMessage: could not resolve orgId for", phone);
      res.status(500).json({ ok: false, error: "org not found" });
      return;
    }

    await requestContext.run({ orgId }, async () => {
      const provider = await getActiveProviderFn();
      if (provider === "twilio" || provider === "cloud_api") {
        const templateSid = TWILIO_TEMPLATE_SID_CALL_INITIAL_ES.value();
        if (!templateSid) throw new Error("TWILIO_TEMPLATE_SID_CALL_INITIAL_ES not configured");
        await sendInitialTemplateMessage({
          to: phone,
          chatId: resolvedChatId,
          language: "es",
          variables: { "1": agentName },
          templateSid,
        });
      } else {
        await sendTextMessage({
          to: phone,
          chatId: resolvedChatId,
          body: buildCallInitialWhatsAppMessageEs(agentName),
        });
      }
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("sendCallHandoffMessage failed", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Process buffered messages - called by Cloud Tasks after buffer delay expires
 */
export const processBuffer = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN, SENDGRID_API_KEY] }, async (req, res) => {
  try {
    // Only accept POST from Cloud Tasks
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify the request is from Cloud Tasks (optional but recommended)
    const taskName = req.headers["x-cloudtasks-taskname"];
    const queueName = req.headers["x-cloudtasks-queuename"];

    if (!taskName && process.env.FUNCTIONS_EMULATOR !== "true") {
      console.warn("Request not from Cloud Tasks, but allowing in production for flexibility");
    }

    console.log(`processBuffer called by task: ${taskName} from queue: ${queueName}`);

    const { chatId, orgId } = req.body as { chatId?: string; orgId?: string };

    if (!chatId) {
      console.error("No chatId provided in request body");
      res.status(400).json({ error: "chatId is required" });
      return;
    }

    const resolvedOrgId = orgId || await findOrgIdByChatId(chatId);
    if (!resolvedOrgId) {
      console.error(`Could not resolve orgId in processBuffer for chatId ${chatId}`);
      await sendAlert(
        "ProcessBuffer missing org",
        "No se pudo resolver orgId al procesar el buffer. Se omite el procesamiento para evitar datos cruzados.",
        { chatId, incomingOrgId: orgId || null }
      );
      res.status(200).json({ processed: false, reason: "org_not_resolved", chatId });
      return;
    }

    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      console.log(`Processing buffered messages for chatId: ${chatId} (Org: ${resolvedOrgId})`);

      // Get pending messages and clear them atomically
      const pendingMessages = await getPendingMessagesAndClear(chatId);

      if (pendingMessages.length === 0) {
        console.log(`No pending messages for ${chatId}, possibly already processed`);
        res.status(200).json({ processed: false, reason: "No pending messages" });
        return;
      }

      console.log(`Found ${pendingMessages.length} pending message(s) to process for ${chatId}`);

      // Get conversation state
      const state = await ensureConversationState(chatId);
      if (!state) {
        console.error(`Could not get conversation state for ${chatId} in org ${resolvedOrgId}`);
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      // Process all buffered messages at once
      await processBufferedMessages(state, pendingMessages);

      // Update in-memory cache
      conversationStates.set(chatId, state);

      console.log(`Successfully processed ${pendingMessages.length} message(s) for ${chatId}`);

      res.status(200).json({
        processed: true,
        messageCount: pendingMessages.length,
        chatId,
      });
    });
  } catch (error) {
    console.error("processBuffer error:", error);
    await sendAlert("ProcessBuffer Error", `Error al procesar buffer de mensajes`, {
      error: error instanceof Error ? error.message : String(error)
    });
    // Return 500 so Cloud Tasks can retry if configured
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Shared WhatsApp onboarding after a listing is resolved (Idealista webhook / newLead).
 * Same Twilio template / Whapi flow as legacy newLead. No credit deduction (disabled until re-enabled).
 */
export async function runNewLeadMessagingPipeline(params: {
  phone: string;
  listingCode: string;
  listingData: ListingRow;
  leadTags: string[];
}): Promise<
  | { ok: true; chatId: string; initialHistory: HistoryItem[]; featuresText: string }
  | { ok: false; kind: "send_failed"; chatId: string; details: string; initialHistory: HistoryItem[]; featuresText: string }
> {
  const { phone, listingCode, listingData, leadTags } = params;

  const initialLanguage = resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listingData.features, initialLanguage);
  const initialMessages = composeInitialMessages(listingData.operationType, listingData.link, featuresText, {
    language: initialLanguage,
  });

  let chatId: string = normalizeToCanonicalChatId(phone);
  const listingAddress =
    [listingData.street, listingData.address].filter(Boolean).join(", ").trim() || listingData.address;

  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      tags: leadTags,
    });
  } catch (error) {
    console.warn("Failed to create preliminary lead record", error);
  }

  const initialHistory: HistoryItem[] = [];

  try {
    const provider = await getActiveProviderFn();
    if (provider === "twilio" || provider === "cloud_api") {
      const agentName = listingData.agentName || "Paco";
      const formattedFeatures = formatFeaturesList(featuresText, initialLanguage);
      const sanitizedFeatures = formattedFeatures.replace(/\n/g, " | ");

      // Resolve cloud_api template name by language (if applicable).
      let cloudApiTemplateName: string | undefined;
      if (provider === "cloud_api") {
        const creds = await getCloudApiCredentials();
        cloudApiTemplateName =
          initialLanguage === "en"
            ? creds.templates?.idealistaInitialEn
            : creds.templates?.idealistaInitialEs;
        if (!cloudApiTemplateName) {
          throw new Error(
            `Missing Cloud API template name (idealistaInitial${initialLanguage === "en" ? "En" : "Es"}) in botConfig.cloudApiConfig.templates`
          );
        }
      }

      const result = await sendInitialTemplateMessage({
        to: phone,
        chatId,
        language: initialLanguage,
        variables: {
          "1": agentName,
          "2": listingData.link,
          "3": sanitizedFeatures,
        },
        mediaUrl: "https://real-estate-idealista-bot.web.app/idealista.jpg",
        templateName: cloudApiTemplateName,
      });

      if (result.chatId && result.chatId !== chatId) {
        chatId = result.chatId;
      }

      const templateText =
        initialLanguage === "en"
          ? `Hi, I'm Marcos, the virtual assistant for ${agentName}, it's a pleasure to help you 🙂\n\nYou've shown interest in this property: ${listingData.link}\n\nJust to confirm, have you reviewed the property highlights?\n\n${formattedFeatures}\n\nI look forward to hearing from you.`
          : `Hola, soy Marcos, el asistente virtual de ${agentName}, un placer atenderte 🙂\n\nTe has interesado en esta vivienda: ${listingData.link}\n\nPor confirmar, ¿has visto las características?\n\n${formattedFeatures}\n\nEspero tu respuesta.`;

      initialHistory.push({
        role: "assistant",
        text: templateText,
        timestamp: Date.now(),
      });
    } else {
      for (let i = 0; i < initialMessages.length; i += 1) {
        const body = initialMessages[i];
        const result = await sendTextMessage({ to: phone, body, chatId });

        if (result.chatId && result.chatId !== chatId) {
          chatId = result.chatId;
        }

        initialHistory.push({
          role: "assistant",
          text: body,
          timestamp: Date.now() + i,
        });
      }
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const state: ConversationState = {
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      description: listingData.description,
      link: listingData.link,
      address: listingAddress,
      features: featuresText,
      profitabilityReportAvailable: listingData.profitabilityReportAvailable,
      profitabilityReport: listingData.profitabilityReport,
      history: initialHistory,
      pendingUserMessages: [],
      isFinished: false,
      tags: leadTags,
      recordings: [],
    };

    await upsertConversation(chatId, { ...state, type: "lead" });
    conversationStates.set(chatId, state);

    return { ok: false, kind: "send_failed", chatId, details, initialHistory, featuresText };
  }

  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      tags: leadTags,
    });
  } catch (error) {
    console.error("Error updating lead with final chatId", error);
  }

  const state: ConversationState = {
    phone,
    listingCode,
    chatId,
    operationType: listingData.operationType,
    description: listingData.description,
    link: listingData.link,
    address: listingAddress,
    features: featuresText,
    profitabilityReportAvailable: listingData.profitabilityReportAvailable,
    profitabilityReport: listingData.profitabilityReport,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
    tags: leadTags,
    recordings: [],
  };

  conversationStates.set(chatId, { ...state, type: "lead" });
  await upsertConversation(chatId, { ...state, tags: leadTags, type: "lead" });

  return { ok: true, chatId, initialHistory, featuresText };
}

async function runIdealistaConfirmPipeline(params: {
  phone: string;
  listingCode: string;
  listingData: ListingRow;
  leadTags: string[];
  leadName?: string;
  language?: "es" | "en";
}): Promise<
  | { ok: true; chatId: string; initialHistory: HistoryItem[]; featuresText: string }
  | { ok: false; kind: "send_failed"; chatId: string; details: string; initialHistory: HistoryItem[]; featuresText: string }
> {
  const { phone, listingCode, listingData, leadTags, leadName, language } = params;
  const initialLanguage = language || resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listingData.features, initialLanguage);

  const chatId: string = normalizeToCanonicalChatId(phone);
  const listingAddress =
    [listingData.street, listingData.address].filter(Boolean).join(", ").trim() || listingData.address;

  // A6c — Idealista leads are cold by definition: no recorded WhatsApp opt-in.
  // Meta Business Messaging Policy + GDPR require prior consent before sending a
  // marketing template, regardless of provider (Cloud API or Twilio). So we send
  // an SMS with a wa.me link; the lead's click → first inbound WhatsApp message
  // opens the 24h session window (implicit consent).
  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      name: leadName,
      tags: leadTags,
      qualificationStatus: "not_qualified",
    });
  } catch (error) {
    console.warn("Failed to create preliminary lead record (idealista confirm)", error);
  }

  const state: ConversationState = {
    phone,
    listingCode,
    chatId,
    operationType: listingData.operationType,
    description: listingData.description,
    link: listingData.link,
    address: listingAddress,
    features: featuresText,
    profitabilityReportAvailable: listingData.profitabilityReportAvailable,
    profitabilityReport: listingData.profitabilityReport,
    history: [],
    pendingUserMessages: [],
    isFinished: false,
    tags: leadTags,
    recordings: [],
    flowStep: "idealista_confirm",
    botDisabled: false,
    name: leadName,
  };
  conversationStates.set(chatId, { ...state, type: "lead" });
  await upsertConversation(chatId, {
    ...state,
    type: "lead",
    idealistaDescription: listingData.idealistaDescription || "",
  });

  try {
    const phoneDigits = phone.replace(/[^0-9]/g, "");
    const phoneE164 = phone.startsWith("+") ? phone : `+${phoneDigits}`;
    await sendIdealistaOptInSms({
      phoneE164,
      name: leadName || "",
      listingCode,
      baseDomain: initialLanguage === "en" ? undefined : undefined, // reserved for future i18n
    });
    return { ok: true, chatId, initialHistory: [], featuresText };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(`runIdealistaConfirmPipeline SMS opt-in failed for ${phone}: ${details}`, error);
    return { ok: false, kind: "send_failed", chatId, details, initialHistory: [], featuresText };
  }
}

// Legacy template-based Idealista confirm flow removed. Prior to Meta App Review
// the bot sent a WhatsApp template directly to cold Idealista leads. This violated
// the Business Messaging Policy's opt-in requirement. The path above now sends an
// SMS opt-in link instead; the lead's first inbound WhatsApp message opens the 24h
// window and implicit consent, after which the conversational flow proceeds normally.

export const newLead = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN, SENDGRID_API_KEY] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const phone = typeof req.body?.telefono === "string" ? req.body.telefono.trim() : "";
  const listingCode = typeof req.body?.anuncio === "string" ? req.body.anuncio.trim() : "";
  const orgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
  const leadName = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const languageNorm = language === "en" ? "en" : language === "es" ? "es" : "";

  if (!phone || !listingCode) {
    res.status(400).json({ error: "telefono y anuncio son obligatorios" });
    return;
  }

  // 1. Resolve organization from listing code
  let resolvedOrgId = orgId;
  let listingData: ListingRow | null = null;
  
  try {
    if (resolvedOrgId) {
      // If orgId is provided, fetch listing within that org context
      await requestContext.run({ orgId: resolvedOrgId }, async () => {
        listingData = await fetchListingByCode(listingCode);
      });
    } else {
      // Fallback to global search if orgId is not provided
      const globalResult = await fetchListingGlobally(listingCode);
      if (globalResult) {
        resolvedOrgId = globalResult.orgId;
        listingData = globalResult.data;
      }
    }
  } catch (error) {
    console.error(`Error resolving listing ${listingCode} (orgId: ${resolvedOrgId || "global"}):`, error);
    res.status(500).json({ 
      error: "Error interno al buscar el anuncio",
      details: error instanceof Error ? error.message : String(error),
      listingCode,
      orgId: resolvedOrgId || undefined
    });
    return;
  }

  if (!listingData || !resolvedOrgId) {
    console.warn(`Listing ${listingCode} not found in any organization.`);
    res.status(404).json({ error: "Anuncio no encontrado" });
    return;
  }

  // 2. Run the rest of the logic with the correct organization context
  try {
    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      // Check if conversation already exists for this phone and listing and is still open
      const existingConv = await getConversationByPhoneAndListing(phone, listingCode);
      if (existingConv && !existingConv.isFinished) {
        console.log(`Lead ${phone} already has an open conversation for ${listingCode} in org ${resolvedOrgId}. Sending returning message.`);

        const isSpanish = isSpanishPhoneNumber(phone);
        const returnMessage = isSpanish
          ? "Has vuelto a contactar por Idealista en relación al anuncio mostrado arriba, ¿cómo te puedo ayudar?"
          : "You have contacted us again through Idealista regarding the property shown above, how can I help you?";

        try {
          await sendTextMessage({ to: phone, body: returnMessage, chatId: existingConv.chatId });

          // Update history
          const updatedHistory = [...(existingConv.history || [])];
          updatedHistory.push({
            role: "assistant",
            text: returnMessage,
            timestamp: Date.now(),
          });

          await upsertConversation(existingConv.chatId, { history: updatedHistory, tags: ["lead"], type: "lead" });

          // Also update lead info to mark recent activity
          await updateLeadChatInfo({
            phone,
            listingCode,
            chatId: existingConv.chatId,
            operationType: existingConv.operationType as OperationType,
          });

          res.status(200).json({ chatId: existingConv.chatId, message: "Returning lead message sent" });
          return;
        } catch (error) {
          console.error("Error handling returning lead:", error);
        }
      }

      const pipeline = await runIdealistaConfirmPipeline({
        phone,
        listingCode,
        listingData: listingData!,
        leadTags: ["lead"],
        leadName: leadName || undefined,
        language: (languageNorm as "es" | "en" | "") || undefined,
      });

      if (!pipeline.ok) {
        res.status(502).json({
          error: "No se pudieron enviar los mensajes iniciales (pero el lead ha sido guardado)",
          details: pipeline.details,
          chatId: pipeline.chatId,
        });
        return;
      }

      res.status(200).json({ chatId: pipeline.chatId, success: true });
    });
  } catch (error) {
    console.error("Fatal error in newLead pipeline:", error);
    res.status(500).json({ 
      error: "Error interno procesando el lead", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export const sendMessage = onRequest({ cors: true, region: REGION, secrets: [WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { chatId, text } = req.body;
  if (!chatId || !text) {
    res.status(400).json({ error: "chatId and text are required" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const state = await ensureConversationState(chatId);
      if (!state) {
        res.status(404).json({ error: "Conversación no encontrada" });
        return;
      }

      // Send via messaging provider
      await sendTextMessage({ to: state.phone, body: text, chatId });

      // Add to history
      const updatedHistory = [...(state.history || [])];
      updatedHistory.push({
        role: "assistant",
        text,
        timestamp: Date.now(),
      });

      await upsertConversation(chatId, { history: updatedHistory });
      conversationStates.set(chatId, { ...state, history: updatedHistory });

      res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: String(error) });
  }
});

export const sendMassMessage = onRequest({ cors: true, region: REGION, secrets: [WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { chatIds, text } = req.body;
  if (!chatIds || !Array.isArray(chatIds) || !text) {
    res.status(400).json({ error: "chatIds (array) and text are required" });
    return;
  }

  console.log(`Sending mass message to ${chatIds.length} chats`);

  try {
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      console.log(`Sending mass message to ${chatIds.length} chats in org ${orgId}`);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as { chatId: string; error: string }[],
      };

      await Promise.all(
        chatIds.map(async (chatId) => {
          try {
            const state = await ensureConversationState(chatId);
            if (!state) {
              throw new Error("Conversación no encontrada");
            }

            // Send via messaging provider
            await sendTextMessage({ to: state.phone, body: text, chatId });

            // Add to history
            const updatedHistory = [...(state.history || [])];
            updatedHistory.push({
              role: "assistant",
              text,
              timestamp: Date.now(),
            });

            await upsertConversation(chatId, { history: updatedHistory });
            conversationStates.set(chatId, { ...state, history: updatedHistory });

            results.success++;
          } catch (error) {
            console.error(`Error sending mass message to ${chatId}:`, error);
            results.failed++;
            results.errors.push({ chatId, error: String(error) });
          }
        })
      );

      res.status(200).json({
        success: true,
        summary: {
          total: chatIds.length,
          sent: results.success,
          failed: results.failed,
        },
        errors: results.errors,
      });
    });
  } catch (error) {
    console.error("Error in sendMassMessage:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Utility endpoint to retry sending initial messages to leads stuck in the idealista_confirm state.
 */
export const retryMissingLeads = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  const authHeader = req.headers.authorization;
  let orgId = "";
  try {
    orgId = await resolveOrgIdFromToken(authHeader);
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { chatIds: targetChatIds } = req.body;

  await requestContext.run({ orgId }, async () => {
    try {
      const allLeads = await getAllLeadsWithChatId();
      const stuckLeads = [];

      for (const leadSummary of allLeads) {
        const data = leadSummary.data as LeadRow;
        if (!data.chatId) continue;
        
        // If specific chatIds provided, skip if not in list
        if (targetChatIds && Array.isArray(targetChatIds) && !targetChatIds.includes(data.chatId)) {
          continue;
        }

        const conv = await getConversationByChatId(data.chatId);
        // Case 1: Conv exists and is in confirm step with no messages
        // Case 2: Conv doesn't exist at all (initialization failed)
        const isStuck = !conv || (conv.flowStep === "idealista_confirm" && (!conv.history || conv.history.length === 0));
        
        if (isStuck) {
          stuckLeads.push({ data, conv });
        }
      }

      console.log(`Found ${stuckLeads.length} leads to process in org ${orgId}`);
      let processed = 0;
      let failed = 0;

      for (const { data, conv } of stuckLeads) {
        try {
          const listingData = await fetchListingByCode(data.listingCode);
          if (!listingData) {
            console.warn(`Listing ${data.listingCode} not found for lead ${data.phone}`);
            continue;
          }

          const pipeline = await runIdealistaConfirmPipeline({
            phone: data.phone,
            listingCode: data.listingCode,
            listingData,
            leadTags: (conv && conv.tags) || ["lead"],
            leadName: data.name || undefined,
          });

          if (pipeline.ok) {
            processed++;
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`Error retrying lead ${data.phone}:`, e);
          failed++;
        }
      }

      res.status(200).json({
        message: `Retry process complete`,
        found: stuckLeads.length,
        processed,
        failed,
      });
    } catch (error) {
      console.error("Error in retryMissingLeads:", error);
      res.status(500).json({ error: String(error) });
    }
  });
});

/**
 * Sync missed messages from Twilio history (last 48h)
 * Use dryRun=true to just see the orphans without injecting them.
 */
export const syncMissedMessages = onRequest({ 
  cors: true, region: REGION, secrets: [TWILIO_AUTH_TOKEN, ADMIN_TEMPLATE_TOKEN] 
}, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token || token !== ADMIN_TEMPLATE_TOKEN.value()) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const { getOrphanedMessages, reprocessOrphans } = await import("./services/recoveryService");
    const dryRun = req.query.dryRun !== "false"; // Default to true
    const hours = parseInt(req.query.hours as string) || 48;

    const orphans = await getOrphanedMessages(hours);

    if (dryRun) {
      res.status(200).json({
        message: `Found ${orphans.length} orphaned messages in the last ${hours} hours.`,
        dryRun: true,
        orphans
      });
      return;
    }

    const { processed, errors } = await reprocessOrphans(orphans);
    res.status(200).json({
      message: `Recovery complete.`,
      found: orphans.length,
      processed,
      errors
    });

  } catch (error) {
    console.error("Error in syncMissedMessages:", error);
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: "Internal Error", 
      details,
      status: 9
    });
  }
});

/**
 * One-shot helper to create Twilio Content templates used by this bot.
 * You will still need to submit them for WhatsApp approval in Twilio manually.
 *
 * Security: requires `?token=...` matching ADMIN_TEMPLATE_TOKEN.
 */
export const createTwilioTemplates = onRequest({ cors: true, region: REGION, secrets: [ADMIN_TEMPLATE_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token || token !== ADMIN_TEMPLATE_TOKEN.value()) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const suffix = Date.now().toString();
    const idealistaConfirm = await createContentTemplate({
      friendlyName: `idealista_confirm_es_${suffix}`,
      language: "es",
      variables: {
        "1": "Carlos",
        "2": "Paco Granados",
        "3": "https://www.idealista.com/inmueble/110595991",
      },
      types: {
        "twilio/quick-reply": {
          body:
            "Hola {{1}}.\n\n" +
            "Soy Marcos, el asistente virtual de {{2}}.\n\n" +
            "Nos has contactado en Idealista por esta vivienda:\n{{3}}\n\n" +
            "¿Es correcto?",
          actions: [
            { title: "Sí", id: "yes" },
            { title: "No", id: "no" },
          ],
        },
        "twilio/text": {
          body:
            "Hola {{1}}.\n\n" +
            "Soy Marcos, el asistente virtual de {{2}}.\n\n" +
            "Nos has contactado en Idealista por esta vivienda:\n{{3}}\n\n" +
            "¿Es correcto? (Responde: Sí / No)",
        },
      },
    });

    const idealistaConfirmEn = await createContentTemplate({
      friendlyName: `idealista_confirm_en_${suffix}`,
      language: "en",
      variables: {
        "1": "John",
        "2": "Paco Granados",
        "3": "https://www.idealista.com/inmueble/110595991",
      },
      types: {
        "twilio/quick-reply": {
          body:
            "Hi {{1}}.\n\n" +
            "I'm Marcos, the virtual assistant for {{2}}.\n\n" +
            "You contacted us on Idealista about this property:\n{{3}}\n\n" +
            "Is that correct?",
          actions: [
            { title: "Yes", id: "yes" },
            { title: "No", id: "no" },
          ],
        },
        "twilio/text": {
          body:
            "Hi {{1}}.\n\n" +
            "I'm Marcos, the virtual assistant for {{2}}.\n\n" +
            "You contacted us on Idealista about this property:\n{{3}}\n\n" +
            "Is that correct? (Reply: Yes / No)",
        },
      },
    });

    const callInitialEs = await createContentTemplate({
      friendlyName: `call_initial_es_${suffix}`,
      language: "es",
      variables: { "1": "Paco Granados" },
      types: {
        "twilio/text": {
          body:
            "¡Hola! Soy el asistente virtual de {{1}}. Acabamos de hablar por teléfono.\n\n" +
            "Para localizar el anuncio, ¿me indicas por favor cuál es?\n\n" +
            "Me puedes pasar:\n\n" +
            "1) El número de referencia (9 dígitos, empieza por 1)\n\n" +
            "2) La calle o zona\n\n" +
            "3) El precio\n\n" +
            "4) O pegar directamente el enlace al anuncio",
        },
      },
    });

    res.status(200).json({
      idealistaConfirm: idealistaConfirm.contentSid,
      idealistaConfirmEn: idealistaConfirmEn.contentSid,
      callInitialEs: callInitialEs.contentSid,
      note: "Configura TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_ES / _EN / TWILIO_TEMPLATE_SID_CALL_INITIAL_ES con estos ContentSid tras aprobación de WhatsApp.",
    });
  } catch (error) {
    console.error("createTwilioTemplates error", error);
    const errAny = error as unknown as { message?: string; response?: { data?: unknown; status?: number } };
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      twilioStatus: errAny.response?.status,
      twilioData: errAny.response?.data,
    });
  }
});

/**
 * Generate the WhatsApp Cloud API templates for the active organization via Meta's
 * `/{WABA_ID}/message_templates` endpoint. Authentication is the user's Firebase ID token
 * (same pattern as other UI-facing endpoints).
 *
 * Creates 6 templates (3 use cases × 2 languages):
 *   - idealistaInitial  (ES/EN) — business-initiated introduction with image header
 *   - idealistaConfirm  (ES/EN) — quick-reply Yes/No confirmation
 *   - agentNotification (ES/EN) — simple body template used as the 24h-window fallback
 *
 * The resulting names are persisted in `botConfig.cloudApiConfig.templates` so callers
 * (pipelines, agent notifications) can resolve them by language at send time.
 */
export const createCloudApiTemplates = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        // Meta requires lowercase, alphanumeric + underscores, max 512 chars. Suffix makes names unique
        // so callers can re-run this helper without colliding with templates already in review.
        const suffix = Date.now().toString();

        const idealistaInitialEsName = `idealista_initial_es_${suffix}`;
        const idealistaInitialEnName = `idealista_initial_en_${suffix}`;
        const idealistaConfirmEsName = `idealista_confirm_es_${suffix}`;
        const idealistaConfirmEnName = `idealista_confirm_en_${suffix}`;
        const agentNotificationEsName = `agent_notification_es_${suffix}`;
        const agentNotificationEnName = `agent_notification_en_${suffix}`;

        // --- idealista_initial (with image header, 3 body variables) ---
        const idealistaInitialEsComponents: CreateTemplateComponent[] = [
          {
            type: "HEADER",
            format: "IMAGE",
            example: { header_handle: ["https://real-estate-idealista-bot.web.app/idealista.jpg"] },
          },
          {
            type: "BODY",
            text:
              "Hola, soy Marcos, el asistente virtual de {{1}}, un placer atenderte.\n\n" +
              "Te has interesado en esta vivienda: {{2}}\n\n" +
              "Por confirmar, ¿has visto las características?\n\n{{3}}",
            example: { body_text: [["Paco", "https://www.idealista.com/inmueble/110595991", "3 hab. | 85 m² | 2 baños"]] },
          },
          { type: "FOOTER", text: "Responde BAJA para dejar de recibir mensajes." },
        ];
        const idealistaInitialEnComponents: CreateTemplateComponent[] = [
          {
            type: "HEADER",
            format: "IMAGE",
            example: { header_handle: ["https://real-estate-idealista-bot.web.app/idealista.jpg"] },
          },
          {
            type: "BODY",
            text:
              "Hi, I'm Marcos, the virtual assistant for {{1}}, a pleasure to help you.\n\n" +
              "You've shown interest in this property: {{2}}\n\n" +
              "Just to confirm, have you reviewed the property highlights?\n\n{{3}}",
            example: { body_text: [["Paco", "https://www.idealista.com/inmueble/110595991", "3 bed | 85 m² | 2 bath"]] },
          },
          { type: "FOOTER", text: "Reply STOP to unsubscribe from messages." },
        ];

        // --- idealista_confirm (quick-reply Yes/No, 3 body variables, no header) ---
        const idealistaConfirmEsComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text:
              "Hola {{1}}.\n\n" +
              "Soy Marcos, el asistente virtual de {{2}}.\n\n" +
              "Nos has contactado en Idealista por esta vivienda:\n{{3}}\n\n" +
              "¿Es correcto?",
            example: { body_text: [["Carlos", "Paco Granados", "https://www.idealista.com/inmueble/110595991"]] },
          },
          { type: "FOOTER", text: "Responde BAJA para dejar de recibir mensajes." },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Sí" },
              { type: "QUICK_REPLY", text: "No" },
            ],
          },
        ];
        const idealistaConfirmEnComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text:
              "Hi {{1}}.\n\n" +
              "I'm Marcos, the virtual assistant for {{2}}.\n\n" +
              "You contacted us on Idealista about this property:\n{{3}}\n\n" +
              "Is that correct?",
            example: { body_text: [["John", "Paco Granados", "https://www.idealista.com/inmueble/110595991"]] },
          },
          { type: "FOOTER", text: "Reply STOP to unsubscribe from messages." },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Yes" },
              { type: "QUICK_REPLY", text: "No" },
            ],
          },
        ];

        // --- agent_notification (1 body variable — fallback for outside-24h agent alerts) ---
        const agentNotificationEsComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text: "{{1}}",
            example: { body_text: [["Tienes un nuevo lead cualificado."]] },
          },
        ];
        const agentNotificationEnComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text: "{{1}}",
            example: { body_text: [["You have a new qualified lead."]] },
          },
        ];

        const createdIds: Record<string, string> = {};
        const created: Record<string, string> = {};

        async function create(
          name: string,
          language: string,
          category: "UTILITY" | "MARKETING",
          components: CreateTemplateComponent[]
        ) {
          const result = await createCloudApiMessageTemplate({ name, category, language, components });
          createdIds[name] = result.id;
          created[name] = result.status;
        }

        await create(idealistaInitialEsName, "es", "MARKETING", idealistaInitialEsComponents);
        await create(idealistaInitialEnName, "en", "MARKETING", idealistaInitialEnComponents);
        await create(idealistaConfirmEsName, "es", "UTILITY", idealistaConfirmEsComponents);
        await create(idealistaConfirmEnName, "en", "UTILITY", idealistaConfirmEnComponents);
        await create(agentNotificationEsName, "es", "UTILITY", agentNotificationEsComponents);
        await create(agentNotificationEnName, "en", "UTILITY", agentNotificationEnComponents);

        await updateCloudApiTemplates({
          idealistaInitialEs: idealistaInitialEsName,
          idealistaInitialEn: idealistaInitialEnName,
          idealistaConfirmEs: idealistaConfirmEsName,
          idealistaConfirmEn: idealistaConfirmEnName,
          agentNotificationEs: agentNotificationEsName,
          agentNotificationEn: agentNotificationEnName,
        });

        res.status(200).json({
          ok: true,
          templates: {
            idealistaInitialEs: idealistaInitialEsName,
            idealistaInitialEn: idealistaInitialEnName,
            idealistaConfirmEs: idealistaConfirmEsName,
            idealistaConfirmEn: idealistaConfirmEnName,
            agentNotificationEs: agentNotificationEsName,
            agentNotificationEn: agentNotificationEnName,
          },
          ids: createdIds,
          statuses: created,
          note: "Las plantillas se han creado en estado PENDING. Meta tarda típicamente de minutos a 24h en aprobarlas.",
        });
      });
    } catch (error) {
      console.error("createCloudApiTemplates error", error);
      const errAny = error as unknown as { message?: string; response?: { data?: unknown; status?: number } };
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        metaStatus: errAny.response?.status,
        metaData: errAny.response?.data,
      });
    }
  }
);

/**
 * Health/connectivity check for a single org's Cloud API credentials. Used by the UI
 * "Test connection" button. Authentication via the user's Firebase ID token.
 */
export const cloudApiHealthCheck = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);
      await requestContext.run({ orgId }, async () => {
        const result = await checkCloudApiHealth(orgId);
        res.status(result.status === "ok" ? 200 : 502).json(result);
      });
    } catch (error) {
      console.error("cloudApiHealthCheck error", error);
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Embedded Signup: exchange the short-lived `code` from the FB JS SDK for a
 * long-lived business_integration_system_user_access_token, register the
 * phone number on Cloud API, subscribe our app to the WABA's webhooks, and
 * persist everything so sendText / sendTemplate work immediately after.
 *
 * Returns public config for the UI (phone number id, waba id, graph version)
 * but never leaks the access token to the client.
 */
export const exchangeEmbeddedSignupCode = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: [META_APP_ID, META_APP_SECRET],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      const body = (req.body || {}) as {
        code?: string;
        phoneNumberId?: string;
        wabaId?: string;
      };
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
      const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";
      if (!code || !phoneNumberId || !wabaId) {
        res.status(400).json({ error: "code, phoneNumberId and wabaId are required" });
        return;
      }

      const appId = META_APP_ID.value();
      const appSecret = META_APP_SECRET.value();
      if (!appId || !appSecret) {
        res.status(500).json({ error: "Meta app credentials are not configured on the server" });
        return;
      }

      const accessToken = await exchangeCodeForToken({ code, appId, appSecret });

      const accessTokenSecretName = await storeAccessTokenInSecretManager({
        orgId,
        accessToken,
      });

      const pin = generateRegistrationPin();
      try {
        await registerPhoneNumber({ phoneNumberId, accessToken, pin });
      } catch (error) {
        // Already-registered numbers raise an error; don't block onboarding if
        // the root cause is a prior registration. Surface other failures.
        const message =
          axios.isAxiosError(error)
            ? error.response?.data?.error?.message || error.message
            : error instanceof Error
            ? error.message
            : String(error);
        const alreadyRegistered =
          /already\s*(been)?\s*registered/i.test(message) ||
          /pin\s*mismatch/i.test(message);
        if (!alreadyRegistered) {
          console.error("[embeddedSignup] Phone registration failed", message);
          res.status(502).json({ error: `Phone registration failed: ${message}` });
          return;
        }
        console.warn("[embeddedSignup] Phone already registered; continuing.", message);
      }

      try {
        await subscribeAppToWaba({ wabaId, accessToken });
      } catch (error) {
        const message =
          axios.isAxiosError(error)
            ? error.response?.data?.error?.message || error.message
            : error instanceof Error
            ? error.message
            : String(error);
        console.error("[embeddedSignup] subscribed_apps failed", message);
        res.status(502).json({ error: `WABA subscription failed: ${message}` });
        return;
      }

      const verifyToken = generateVerifyToken();
      const displayPhoneNumber = await fetchDisplayPhoneNumber({ phoneNumberId, accessToken });
      await persistCloudApiConfigForOrg({
        orgId,
        phoneNumberId,
        wabaId,
        accessTokenSecretName,
        verifyToken,
        displayPhoneNumber,
      });

      invalidateCloudApiCredentialsCache(orgId);

      res.status(200).json({
        ok: true,
        phoneNumberId,
        wabaId,
        graphApiVersion: "v23.0",
      });
    } catch (error) {
      console.error("exchangeEmbeddedSignupCode error", error);
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Expose the FB Login for Business config_id (and app_id) to the frontend so
 * the Embedded Signup popup can be launched without baking these into the
 * bundle at build time. Requires an authenticated user.
 */
export const getEmbeddedSignupConfig = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_ID, META_FB_LOGIN_CONFIG_ID] },
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      await resolveOrgIdFromToken(authHeader);
      res.status(200).json({
        appId: META_APP_ID.value(),
        configId: META_FB_LOGIN_CONFIG_ID.value(),
        graphApiVersion: "v23.0",
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Meta Data Deletion Callback (required in App Basic Settings).
 *
 * Meta posts `signed_request` (base64url(sig).base64url(payload)) signed with the app secret.
 * We verify the signature, record a request row keyed by a random confirmation code, and
 * return `{url, confirmation_code}` so the user can track status at /legal/deletion-status.
 *
 * Proplead does not currently persist Facebook-scoped user IDs (we only see WhatsApp phone
 * numbers via Cloud API), so there is no lead data keyed by `user_id` to delete. The row is
 * still recorded for audit + the status page.
 */
export const metaDataDeletion = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const signedRequest =
        (req.body && typeof req.body.signed_request === "string" && req.body.signed_request) ||
        (typeof req.query.signed_request === "string" ? req.query.signed_request : "");
      if (!signedRequest || !signedRequest.includes(".")) {
        res.status(400).json({ error: "Missing signed_request" });
        return;
      }
      const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
      const b64urlToBuf = (s: string): Buffer =>
        Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      const sig = b64urlToBuf(encodedSig);
      const expected = crypto
        .createHmac("sha256", META_APP_SECRET.value())
        .update(encodedPayload)
        .digest();
      if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      const payload = JSON.parse(b64urlToBuf(encodedPayload).toString("utf8")) as {
        user_id?: string;
        algorithm?: string;
      };
      const userId = payload.user_id || "unknown";

      const confirmationCode = crypto.randomBytes(16).toString("hex");
      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      await db.doc(`dataDeletionRequests/${confirmationCode}`).set({
        code: confirmationCode,
        fbUserId: userId,
        status: "completed",
        requestedAt: new Date(),
        note: "No Proplead data is keyed by Facebook user_id; nothing to erase.",
      });

      res.status(200).json({
        url: `https://proplead.io/legal/deletion-status?code=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
    } catch (error) {
      console.error("metaDataDeletion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * A5 — Customer-facing account deletion.
 *
 * Soft-deletes the org (`deletedAt` set), revokes Meta webhook subscription for the
 * connected WABA, and destroys the per-org access token stored in Secret Manager.
 * A daily scheduled job (`purgeDeletedOrganizations`) hard-deletes after 30 days.
 */
export const deleteMyOrganization = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const orgId = await resolveOrgIdFromToken(req.headers.authorization);
      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);

      // Best-effort: revoke subscribed_apps + delete secret. Never block deletion.
      try {
        const creds = await getCloudApiCredentials(orgId);
        await axios
          .delete(`https://graph.facebook.com/${creds.graphApiVersion}/${creds.wabaId}/subscribed_apps`, {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
            timeout: 10000,
          })
          .catch((err) => console.warn("subscribed_apps revoke failed:", err?.message || err));
        // Delete the wabaIndex mapping.
        await db.doc(`wabaIndex/${creds.wabaId}`).delete().catch(() => undefined);
        // Delete the Secret Manager secret for this org.
        try {
          const sm = new SecretManagerServiceClient();
          const projectId =
            process.env.GCLOUD_PROJECT ||
            process.env.GCP_PROJECT ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            admin.app().options.projectId;
          const secretName = `projects/${projectId}/secrets/whatsapp_org_${orgId}_token`;
          await sm.deleteSecret({ name: secretName });
        } catch (err) {
          console.warn("secret delete failed:", (err as Error)?.message || err);
        }
      } catch (err) {
        console.warn("Cloud API creds unavailable during org deletion:", (err as Error)?.message || err);
      }

      await db.doc(`organizations/${orgId}`).set(
        { deletedAt: new Date(), deletedBy: "self_service" },
        { merge: true }
      );

      res.status(200).json({ ok: true, scheduledHardDeleteInDays: 30 });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("deleteMyOrganization error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * A5 — Customer-facing data export (GDPR Art. 20 / DSAR).
 *
 * Gathers the org's Firestore footprint, writes a JSON snapshot to the default
 * Storage bucket, generates a 7-day v4 signed URL, and emails it to the
 * requester via SendGrid.
 */
export const exportMyData = onRequest(
  { cors: true, region: REGION, secrets: [SENDGRID_API_KEY] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const orgId = await resolveOrgIdFromToken(req.headers.authorization);
      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);

      const orgDoc = await db.doc(`organizations/${orgId}`).get();
      const subcollections = ["leads", "conversations", "listings", "auditLogs", "botConfig", "system_config"];
      const data: Record<string, unknown> = {
        orgId,
        exportedAt: new Date().toISOString(),
        organization: orgDoc.data() || null,
      };
      for (const name of subcollections) {
        const snap = await db.collection(`organizations/${orgId}/${name}`).limit(5000).get();
        data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const bucket = admin.storage().bucket();
      const filePath = `dsar/${orgId}/${Date.now()}.json`;
      const file = bucket.file(filePath);
      await file.save(Buffer.from(JSON.stringify(data, null, 2), "utf8"), {
        contentType: "application/json",
        resumable: false,
      });
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 7 * 24 * 3600 * 1000,
      });

      // Email the signed URL to the requester.
      const user = await admin
        .auth()
        .getUser((await admin.auth().verifyIdToken((req.headers.authorization || "").replace(/^Bearer /, ""))).uid);
      if (user.email) {
        await sendEmailToUser({
          to: user.email,
          subject: "Tu exportación de datos de Proplead",
          html: `<p>Hola,</p><p>Hemos preparado la exportación de los datos de tu organización. Podrás descargarla durante los próximos 7 días desde el siguiente enlace:</p><p><a href="${url}">Descargar exportación</a></p><p>Si no solicitaste esta exportación, ignora este correo o escribe a dpo@proplead.io.</p>`,
        });
      }

      res.status(200).json({ ok: true, url, expiresInDays: 7 });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("exportMyData error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Daily sweeper: hard-delete organizations soft-deleted >= 30 days ago.
 * Recursive delete removes all subcollections (leads, conversations, etc.).
 */
export const purgeDeletedOrganizations = onSchedule(
  { schedule: "0 3 * * *", region: REGION, timeZone: "Europe/Madrid" },
  async () => {
    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const snap = await db
      .collection("organizations")
      .where("deletedAt", "<=", cutoff)
      .limit(50)
      .get();
    for (const doc of snap.docs) {
      try {
        await db.recursiveDelete(doc.ref);
        console.log(`purgeDeletedOrganizations: hard-deleted org ${doc.id}`);
      } catch (err) {
        console.error(`purgeDeletedOrganizations failed for ${doc.id}:`, err);
      }
    }
  }
);

/**
 * A6c — /w/{listingCode} short-link.
 *
 * Resolves the org that owns the listing, reads its `cloudApiConfig.displayPhoneNumber`,
 * and 302-redirects to a pre-filled wa.me deep link. The consumer's click does not
 * create consent by itself — consent is recorded when they actually send the message
 * (inbound webhook sees the matching pattern and stamps the lead).
 */
export const waRedirect = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      // path: /waRedirect/{listingCode}  OR  ?code={listingCode}
      const pathParts = (req.path || "").split("/").filter(Boolean);
      const listingCode =
        (typeof req.query.code === "string" && req.query.code) ||
        pathParts[pathParts.length - 1] ||
        "";
      if (!listingCode || !/^[a-zA-Z0-9_-]{3,20}$/.test(listingCode)) {
        res.status(400).send("Invalid listing code");
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      // Listings live at organizations/{orgId}/listings/{listingCode}. Use collectionGroup.
      const snap = await db
        .collectionGroup("listings")
        .where("listingCode", "==", listingCode)
        .limit(1)
        .get();
      if (snap.empty) {
        res.status(404).send("Listing not found");
        return;
      }
      const orgId = snap.docs[0].ref.path.split("/")[1];
      const cfgDoc = await db.doc(`organizations/${orgId}/botConfig/config`).get();
      const displayPhone = (cfgDoc.data()?.cloudApiConfig?.displayPhoneNumber as string | undefined) || "";
      if (!displayPhone) {
        res.status(503).send("Phone number not configured for this organization");
        return;
      }

      const text = `Hola, me interesa la vivienda ${listingCode}`;
      const waUrl = `https://wa.me/${displayPhone}?text=${encodeURIComponent(text)}`;
      res.redirect(302, waUrl);
    } catch (error) {
      console.error("waRedirect error:", error);
      res.status(500).send("Internal server error");
    }
  }
);

export const triggerBot = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { chatId } = req.body;
  if (!chatId) {
    res.status(400).json({ error: "chatId is required" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const state = await ensureConversationState(chatId);
      if (!state) {
        res.status(404).json({ error: "Conversación no encontrada" });
        return;
      }

      // Explicitly check for botDisabled to avoid confusion, 
      // though processBufferedMessages will also check it.
      if (state.botDisabled) {
        res.status(400).json({ error: "El bot está desactivado para esta conversación" });
        return;
      }

      await processBufferedMessages(state, []);
      res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error("Error in triggerBot:", error);
    res.status(500).json({ error: String(error) });
  }
});


export const healthz = onRequest({ cors: true, region: REGION, secrets: [WHAPI_TOKEN] }, async (_req, res) => {
  const whapiStatus = await checkWhapiHealth();

  if (whapiStatus.status !== "ok") {
    res.status(503).json({
      status: "error",
      message: "Whapi service is not reachable or responding correctly",
      details: whapiStatus.details
    });
    return;
  }

  res.status(200).json({ status: "ok", whapi: whapiStatus.details });
});

/**
 * Scheduled health check to verify Whapi is online
 * Runs every 30 minutes
 */
export const monitoringTask = onSchedule({
  schedule: "*/30 * * * *", // Every 30 minutes
  region: REGION,
  timeZone: "Europe/Madrid",
  secrets: [WHAPI_TOKEN],
}, async () => {
  console.log("Running scheduled health check...");
  const whapiStatus = await checkWhapiHealth();

  // Persist last test time + status even when Whapi is OK.
  try {
    const databaseId = "realestate-whatsapp-bot";
    const orgId = getActiveOrgId();
    const db = getFirestore(admin.app(), databaseId);
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");
    await settingsRef.set(
      {
        lastCheckByKey: {
          whapi_down: {
            status: whapiStatus.status === "ok" ? "ok" : "error",
            checkedAt: new Date().toISOString(),
            checkedAtMs: Date.now(),
            details: whapiStatus.details ?? null,
          },
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Failed to persist lastCheckByKey for monitoringTask:", e);
  }

  if (whapiStatus.status !== "ok") {
    await sendAlert(
      "Whapi Down",
      "El servicio de Whapi no responde o el token es inválido.",
      whapiStatus.details
    );
  }
});

// Seed function to initialize collections (commented out - use scripts/addListingsAdmin.mjs instead)
// import { seedCollectionsWithSampleData } from "./seedData";
//
// export const seedCollections = onRequest({ cors: true, region: REGION }, async (_req, res) => {
//   try {
//     await seedCollectionsWithSampleData();
//     res.status(200).json({ 
//       success: true, 
//       message: "Sample data created successfully. Check Firebase Console." 
//     });
//   } catch (error) {
//     console.error("Error seeding data:", error);
//     res.status(500).json({ 
//       error: "Failed to seed data", 
//       details: error instanceof Error ? error.message : String(error) 
//     });
//   }
// });

/**
 * Scheduled function to check for conversations that haven't responded in 24 hours
 * Runs every hour
 */
export const checkFollowUps = onSchedule({
  schedule: "0 * * * *", // Every hour
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Checking for conversations that need a follow-up...");

  try {
    // Get conversations that haven't had a message in 24 hours
    const conversations = await getConversationsForFollowUp(24);

    if (conversations.length === 0) {
      console.log("No conversations need follow-up.");
      return;
    }

    console.log(`Found ${conversations.length} conversation(s) for follow-up.`);

    for (const state of conversations) {
      try {
        const isSpanish = isSpanishPhoneNumber(state.phone);
        const followUpMessage = isSpanish
          ? "¡Hola! Debido a la gran cantidad de interesados, no me gustaría que te quedaras fuera. ¿Me puedes responder al mensaje anterior porfa? :)"
          : "Hi! Due to high demand for this property, I wouldn't want you to miss out. Could you please get back to me regarding my previous message? :)";

        console.log(`Sending follow-up to ${state.phone} (${state.chatId})`);

        // Send the message
        await sendTextMessage({ to: state.phone, body: followUpMessage, chatId: state.chatId });

        // Update history
        const updatedHistory = [...(state.history || [])];
        updatedHistory.push({
          role: "assistant",
          text: followUpMessage,
          timestamp: Date.now(),
        });

        // Update state in Firestore
        await upsertConversation(state.chatId, {
          history: updatedHistory,
          followUpSent: true,
        });

        console.log(`Follow-up sent and state updated for ${state.chatId}`);
      } catch (error) {
        console.error(`Error sending follow-up to ${state.chatId}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in checkFollowUps schedule:", error);
  }
});

export const testAlert = onRequest({ cors: true, region: REGION, secrets: [SENDGRID_API_KEY] }, async (_req, res) => {
  try {
    console.log("Iniciando prueba manual de alerta...");
    await sendAlert(
      "Prueba Manual de Alerta",
      "Si estás leyendo esto, el sistema de notificaciones por correo electrónico está configurado CORRECTAMENTE.",
      {
        timestamp: new Date().toISOString(),
        info: "Prueba solicitada por el usuario"
      }
    );
    res.status(200).json({ success: true, message: "Alerta enviada correctamente" });
  } catch (error) {
    console.error("Error en testAlert:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Manual trigger for testing the welcome email.
 * Usage: https://.../testWelcomeEmail?email=user@example.com&name=Eddy
 */
export const testWelcomeEmail = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: ["SENDGRID_API_KEY"]
  },
  async (req, res) => {
    try {
      const email = (req.query.email as string) || "eddyperez1221@gmail.com";
      const name = (req.query.name as string) || "Eddy";

      console.log(`Sending test welcome email to ${email}...`);

      const { sendWelcomeEmail } = await import("./services/authTriggers");
      await sendWelcomeEmail(email, name);
      
      res.status(200).json({ 
        success: true, 
        message: `Test welcome email sent to ${email} successfully.` 
      });
    } catch (error) {
      console.error("Error in testWelcomeEmail:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  }
);

/**
 * Sync conversations with Whapi every 30 minutes
 * Compares Whapi chat state with Firestore to detect discrepancies
 */
export const syncConversationsTask = onSchedule({
  schedule: "*/30 * * * *", // Every 30 minutes
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Starting scheduled conversation sync...");
  try {
    const result = await syncConversationsWithWhapi();
    console.log(`Sync completed: ${result.chatsChecked} chats, ${result.discrepanciesFound} discrepancies, ${result.errors.length} errors`);
  } catch (error) {
    console.error("Sync task failed:", error);
    await sendAlert("Sync Task Error", "Error crítico en la tarea de sincronización programada", {
      error: error instanceof Error ? error.message : String(error)
    }, "critical");
  }
});

/**
 * Twice-Daily Status Report
 * Runs every 12 hours to confirm the system is healthy
 */
export const twiceDailyStatusReportTask = onSchedule({
  schedule: "0 9,21 * * *", // Twice a day at 9:00 and 21:00
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Starting twice-daily status report...");
  try {
    // 1. Run sync to get latest stats
    const syncResult = await syncConversationsWithWhapi({ silent: true });

    // 2. Get alerts in last 12 hours
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
    const alertsInLastPeriod = await getAlertCountSince(twelveHoursAgo);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 3. Determine overall status
    const status = (syncResult.discrepanciesFound === 0 && alertsInLastPeriod === 0 && syncResult.errors.length === 0)
      ? "OK"
      : "ISSUES";

    const message = status === "OK"
      ? "El sistema está funcionando correctamente. No se han detectado discrepancias ni errores críticos en las últimas 12 horas."
      : `El sistema presenta algunos temas que requieren atención: ${syncResult.discrepanciesFound} discrepancias y ${alertsInLastPeriod} alertas en las últimas 12 horas.`;

    const responseRateStats = await getResponseRateStats(twentyFourHoursAgo);

    await sendHealthReport(
      status === "OK" ? "Todo en orden" : "Revisión necesaria",
      message,
      {
        chatsChecked: syncResult.chatsChecked,
        discrepanciesFound: syncResult.discrepanciesFound,
        alertsInLastHour: alertsInLastPeriod, // Keeping property name for backwards compatibility in alertService
        status,
        responseRate: responseRateStats.rate
      },
      {
        syncErrors: syncResult.errors,
        timestamp: new Date().toISOString()
      }
    );

    console.log(`Twice-daily status report sent. Status: ${status}`);
  } catch (error) {
    console.error("Twice-daily status report failed:", error);
    // Note: We don't send an alert here to avoid infinite loops if alert system is broken,
    // but the task failure will be logged in GCP.
  }
});

/**
 * Retry failed messages every 15 minutes
 * Attempts to resend messages that failed during initial send
 */
export const retryFailedMessagesTask = onSchedule({
  schedule: "*/15 * * * *", // Every 15 minutes
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Starting failed message retry task...");
  try {
    const stats = await retryFailedMessages();
    if (stats.retried > 0) {
      console.log(`Retry complete: ${stats.succeeded}/${stats.retried} succeeded, ${stats.maxedOut} permanently failed`);
    }
  } catch (error) {
    console.error("Retry task failed:", error);
    await sendAlert("Retry Task Error", "Error en la tarea de reintento de mensajes", {
      error: error instanceof Error ? error.message : String(error)
    }, "warning");
  }
});

/**
 * Scheduled agent that analyzes lead conversations and updates structured data.
 * Runs every 6 hours starting at noon (Madrid time): 12:00, 18:00, 00:00, 06:00
 * Uses ChatGPT to extract: pets (boolean), income (€/month), payment method, notes.
 * Only re-analyzes leads that have new messages since last analysis.
 */
export const analyzeLeadsAgent = onSchedule({
  schedule: "0 0,6,12,18 * * *",
  region: REGION,
  timeZone: "Europe/Madrid",
  timeoutSeconds: 540, // 9 minutes max (Cloud Functions gen2 limit)
  memory: "512MiB",
}, async () => {
  console.log("[AnalyzeLeadsAgent] Starting scheduled lead analysis...");

  try {
    const leads = await getAllLeadsWithChatId();
    console.log(`[AnalyzeLeadsAgent] Found ${leads.length} leads with chatId`);

    let analyzed = 0;
    let skipped = 0;
    let errors = 0;

    for (const { docId, data: leadData } of leads) {
      try {
        const chatId = leadData.chatId as string;

        // Get the conversation
        const conversation = await getConversationByChatId(chatId);
        if (!conversation || !conversation.history || conversation.history.length === 0) {
          skipped++;
          continue;
        }

        // Check if there are user messages at all
        const hasUserMessages = conversation.history.some(h => h.role === "user" && h.text.trim());
        if (!hasUserMessages) {
          skipped++;
          continue;
        }

        // Compare lastAnalyzedAt with conversation's lastMessage timestamp
        const lastAnalyzedAt = leadData.lastAnalyzedAt as FirebaseFirestore.Timestamp | undefined;
        const lastMessage = conversation.lastMessage as FirebaseFirestore.Timestamp | undefined;

        if (lastAnalyzedAt && lastMessage) {
          // If the lead was analyzed after the last message, skip
          const analyzedMs = lastAnalyzedAt.toMillis();
          const messageMs = lastMessage.toMillis();
          if (analyzedMs >= messageMs) {
            skipped++;
            continue;
          }
        } else if (lastAnalyzedAt && !lastMessage) {
          // Already analyzed but no lastMessage timestamp — skip to be safe
          skipped++;
          continue;
        }

        // Analyze the full conversation
        console.log(`[AnalyzeLeadsAgent] Analyzing lead ${docId} (chat: ${chatId})`);

        const summary = await summarizeLeadDetails(conversation);

        // Build the analysis update — always replace all fields
        const analysisUpdate: {
          pets?: boolean;
          income?: number;
          paymentMethod?: "Contado" | "Hipoteca";
          notes?: string;
          name?: string;
        } = {};

        if (summary.pets !== undefined) analysisUpdate.pets = summary.pets;
        if (summary.income !== undefined) analysisUpdate.income = summary.income;
        if (summary.paymentMethod !== undefined) analysisUpdate.paymentMethod = summary.paymentMethod;
        if (summary.notes !== undefined) analysisUpdate.notes = summary.notes;
        if (summary.name !== undefined) analysisUpdate.name = summary.name;

        await updateLeadAnalysis(docId, analysisUpdate);
        analyzed++;

        console.log(`[AnalyzeLeadsAgent] Updated lead ${docId}: pets=${summary.pets}, income=${summary.income}, paymentMethod=${summary.paymentMethod}`);
      } catch (error) {
        errors++;
        console.error(`[AnalyzeLeadsAgent] Error analyzing lead ${docId}:`, error);
      }
    }

    console.log(`[AnalyzeLeadsAgent] Complete. Analyzed: ${analyzed}, Skipped: ${skipped}, Errors: ${errors}`);
  } catch (error) {
    console.error("[AnalyzeLeadsAgent] Fatal error:", error);
  }
});

/**
 * Manual trigger for sync (for testing)
 */
export const triggerSync = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  try {
    console.log("Manual sync triggered...");
    const result = await syncConversationsWithWhapi();
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Manual sync failed:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Manual trigger for lead analysis (for testing).
 * Forces re-analysis of ALL leads regardless of lastAnalyzedAt.
 */
export const triggerAnalyzeLeads = onRequest({ cors: true, region: REGION, timeoutSeconds: 540, memory: "512MiB" }, async (_req, res) => {
  console.log("[AnalyzeLeadsAgent] Manual trigger — analyzing ALL leads...");
  try {
    const leads = await getAllLeadsWithChatId();
    console.log(`[AnalyzeLeadsAgent] Found ${leads.length} leads with chatId`);

    let analyzed = 0;
    let skipped = 0;
    let errors = 0;
    const results: { docId: string; status: string; summary?: Record<string, unknown> }[] = [];

    for (const { docId, data: leadData } of leads) {
      try {
        const chatId = leadData.chatId as string;

        const conversation = await getConversationByChatId(chatId);
        if (!conversation || !conversation.history || conversation.history.length === 0) {
          skipped++;
          results.push({ docId, status: "skipped_no_conversation" });
          continue;
        }

        const hasUserMessages = conversation.history.some(h => h.role === "user" && h.text.trim());
        if (!hasUserMessages) {
          skipped++;
          results.push({ docId, status: "skipped_no_user_messages" });
          continue;
        }

        console.log(`[AnalyzeLeadsAgent] Analyzing lead ${docId} (chat: ${chatId})`);
        const summary = await summarizeLeadDetails(conversation);

        const analysisUpdate: {
          pets?: boolean;
          income?: number;
          paymentMethod?: "Contado" | "Hipoteca";
          notes?: string;
          name?: string;
        } = {};

        if (summary.pets !== undefined) analysisUpdate.pets = summary.pets;
        if (summary.income !== undefined) analysisUpdate.income = summary.income;
        if (summary.paymentMethod !== undefined) analysisUpdate.paymentMethod = summary.paymentMethod;
        if (summary.notes !== undefined) analysisUpdate.notes = summary.notes;
        if (summary.name !== undefined) analysisUpdate.name = summary.name;

        await updateLeadAnalysis(docId, analysisUpdate);
        analyzed++;
        results.push({ docId, status: "analyzed", summary: analysisUpdate as Record<string, unknown> });

        console.log(`[AnalyzeLeadsAgent] Updated lead ${docId}`);
      } catch (error) {
        errors++;
        results.push({ docId, status: "error", summary: { error: String(error) } });
        console.error(`[AnalyzeLeadsAgent] Error analyzing lead ${docId}:`, error);
      }
    }

    console.log(`[AnalyzeLeadsAgent] Complete. Analyzed: ${analyzed}, Skipped: ${skipped}, Errors: ${errors}`);
    res.status(200).json({ success: true, analyzed, skipped, errors, results });
  } catch (error) {
    console.error("[AnalyzeLeadsAgent] Fatal error:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ==================== CREDITS & STRIPE FUNCTIONS ====================

/**
 * Get available conversation packages
 */
export const getPackages = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  try {
    const packages = getConversationPackages();
    res.status(200).json({ packages });
  } catch (error) {
    console.error("Error getting packages:", error);
    res.status(500).json({ error: "Failed to get packages" });
  }
});

/**
 * Get user's conversation balance
 * Requires Authorization header with Firebase ID token
 */
export const getConversations = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const balance = await getOrgConversationBalance();
      res.status(200).json({ balance });
    });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

type SubscriptionBillingInterval = "month" | "year";

/**
 * Map planId to the Stripe Price ID stored in environment variables
 */
// Nuevos Price IDs proporcionados
const STRIPE_PRICES = {
  month: {
    plus: "price_1TLLeVCXIAxi00WslhmS8iBo",
    pro: "price_1TLLfCCXIAxi00WsvsJgg2sB",
    pro_plus: "price_1TLLgWCXIAxi00WsqK4dIosW",
    extra: "price_1TLLo5CXIAxi00WsmOdzmaTC"
  },
  year: {
    plus: "price_1TLLl3CXIAxi00WsvKDacgj5",
    pro: "price_1TLLlWCXIAxi00WsiVzogPKo",
    pro_plus: "price_1TLLmFCXIAxi00Ws5WJMKj4k",
    extra: "price_1TLLvuCXIAxi00WsueKJHmrl"
  }
} as const;

function getPriceIdForPlan(planId: string, billingInterval: SubscriptionBillingInterval = "month"): string {
  if (billingInterval === "year") {
    const priceId = process.env[
      planId === "pro_plus" ? "STRIPE_PRO_PLUS_ANNUAL_PRICE_ID" :
      planId === "pro" ? "STRIPE_PRO_ANNUAL_PRICE_ID" : 
      "STRIPE_PLUS_ANNUAL_PRICE_ID"
    ]?.trim() || STRIPE_PRICES.year[planId as keyof typeof STRIPE_PRICES.year];
    
    if (!priceId || priceId.includes("REPLACE")) {
      throw new Error("Contratación anual no disponible para el plan solicitado.");
    }
    return priceId;
  }

  const priceId = process.env[
    planId === "pro_plus" ? "STRIPE_PRO_PLUS_PRICE_ID" :
    planId === "pro" ? "STRIPE_PRO_PRICE_ID" : 
    "STRIPE_PLUS_PRICE_ID"
  ]?.trim() || STRIPE_PRICES.month[planId as keyof typeof STRIPE_PRICES.month];
  
  if (!priceId || priceId.includes("REPLACE")) {
    throw new Error(`No valid Stripe Price ID for plan "${planId}".`);
  }
  return priceId;
}

function getExtraBlocksPriceId(billingInterval: SubscriptionBillingInterval = "month"): string {
  return billingInterval === "year" 
    ? process.env.STRIPE_EXTRA_ANNUAL_PRICE_ID?.trim() || STRIPE_PRICES.year.extra
    : process.env.STRIPE_EXTRA_MONTHLY_PRICE_ID?.trim() || STRIPE_PRICES.month.extra;
}

/**
 * Create a Stripe Checkout session for a recurring subscription plan.
 * Requires Authorization header with Firebase ID token.
 */
export const createSubscriptionCheckout = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: [
      "STRIPE_API_KEY",
      "STRIPE_PLUS_PRICE_ID",
      "STRIPE_PRO_PRICE_ID",
      "STRIPE_PRO_PLUS_PRICE_ID",
      "STRIPE_PLUS_ANNUAL_PRICE_ID",
      "STRIPE_PRO_ANNUAL_PRICE_ID",
      "STRIPE_PRO_PLUS_ANNUAL_PRICE_ID",
    ],
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { planId, successUrl, cancelUrl, billingInterval: rawBilling, extraBlocks = 0 } = req.body as {
          planId?: string;
          successUrl?: string;
          cancelUrl?: string;
          billingInterval?: string;
          extraBlocks?: number;
        };

        if (!planId || !successUrl || !cancelUrl) {
          res.status(400).json({ error: "planId, successUrl, and cancelUrl are required" });
          return;
        }

        if (!["plus", "pro", "pro_plus"].includes(planId)) {
          res.status(400).json({ error: `Invalid planId: ${planId}. Must be one of: plus, pro, pro_plus` });
          return;
        }

        const billingInterval: SubscriptionBillingInterval =
          rawBilling === "year" ? "year" : "month";

        const basePriceId = getPriceIdForPlan(planId, billingInterval);
        const extraPriceId = getExtraBlocksPriceId(billingInterval);
        
        const lineItems: any[] = [
          {
            price: basePriceId,
            quantity: 1
          }
        ];

        if (extraBlocks > 0) {
          lineItems.push({
            price: extraPriceId,
            quantity: extraBlocks
          });
        }

        const session = await createSubscriptionCheckoutSession(
          orgId,
          planId,
          lineItems,
          extraBlocks,
          successUrl,
          cancelUrl
        );
        console.log(`[createSubscriptionCheckout] Created session for org: ${orgId}, plan: ${planId}`);

        res.status(200).json({ sessionId: session.sessionId, url: session.url });
      });
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create subscription checkout" });
    }
  }
);

/**
 * Get the current subscription for the org.
 * Returns planId, status, and currentPeriodEnd.
 * Requires Authorization header with Firebase ID token.
 */
export const getSubscription = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const activeOrgId = getActiveOrgId();
      const sub = await getOrgSubscription(activeOrgId);

      if (!sub) {
        res.status(200).json({ planId: "free", status: "active", currentPeriodEnd: null, contractedConversations: PLAN_BASE_CONVERSATIONS["free"] });
        return;
      }

      const baseConversations = PLAN_BASE_CONVERSATIONS[sub.planId] ?? 0;
      const contractedConversations = baseConversations + (sub.extraBlocks ?? 0) * 40;

      res.status(200).json({
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        contractedConversations,
        billingInterval: sub.billingInterval || "month",
        stripeSubscriptionId: sub.stripeSubscriptionId,
        extraBlocks: sub.extraBlocks || 0,
      });
    });
  } catch (error) {
    console.error("Error getting subscription:", error);
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

/**
 * Create a Stripe Billing Portal session for managing subscriptions
 */
export const createBillingPortalSession = onRequest(
  { cors: true, region: REGION, secrets: ["STRIPE_API_KEY"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { returnUrl } = req.body as { returnUrl?: string };
        if (!returnUrl) {
          res.status(400).json({ error: "returnUrl is required" });
          return;
        }
        const activeOrgId = getActiveOrgId();
        const customerId = await getOrgStripeCustomerId(activeOrgId);
        if (!customerId) {
          res.status(400).json({ error: "No Stripe customer found for this organization" });
          return;
        }
        const session = await createBillingPortalSessionService(orgId, customerId, returnUrl);
        console.log(`[createBillingPortalSession] Created portal for org: ${orgId}`);
        res.status(200).json({ url: session.url });
      });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create billing portal session" });
    }
  }
);

/**
 * Create a Stripe Checkout session for purchasing credits
 */
export const createStripeCheckout = onRequest({ cors: true, region: REGION, secrets: ["STRIPE_API_KEY", STRIPE_PRICE_TOPUP_40_CONVS] }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const decodedToken = await admin.auth().verifyIdToken(authHeader?.split("Bearer ")[1] || "");
      const userId = decodedToken.uid;

      const { packageId, successUrl, cancelUrl, quantity: rawQty } = req.body as {
        packageId?: string;
        successUrl?: string;
        cancelUrl?: string;
        quantity?: number;
      };

      if (!packageId || !successUrl || !cancelUrl) {
        res.status(400).json({ error: "packageId, successUrl, and cancelUrl are required" });
        return;
      }

      const parsedQty =
        rawQty === undefined || rawQty === null
          ? 1
          : typeof rawQty === "number"
            ? rawQty
            : parseInt(String(rawQty), 10);
      const quantity = Number.isFinite(parsedQty) ? Math.floor(parsedQty) : 1;

      const activeOrgId = getActiveOrgId();
      const existingCustomerId = await getOrgStripeCustomerId(activeOrgId);
      const session = await createCheckoutSession(
        userId,
        orgId,
        packageId,
        successUrl,
        cancelUrl,
        existingCustomerId ?? undefined,
        quantity,
        packageId === "extra_40" ? STRIPE_PRICE_TOPUP_40_CONVS.value() : undefined
      );
      console.log(`[createStripeCheckout] Created checkout for org: ${orgId}, user: ${userId}`);

      res.status(200).json({
        sessionId: session.sessionId,
        url: session.url,
      });
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create checkout session" });
  }
});

/**
 * Persist auto-recharge preferences for the org.
 */
export const saveAutoRechargeSettings = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const body = req.body as {
        enabled?: boolean;
        thresholdConversations?: number;
        rechargeConversations?: number;
      };
      if (typeof body.enabled !== "boolean") {
        res.status(400).json({ error: "enabled (boolean) is required" });
        return;
      }

      await saveOrgAutoRechargeSettings(orgId, {
        enabled: body.enabled,
        thresholdConversations: typeof body.thresholdConversations === "number" ? body.thresholdConversations : 20,
        rechargeConversations: typeof body.rechargeConversations === "number" ? body.rechargeConversations : 40,
      });
      console.log(`[saveAutoRechargeSettings] Settings saved for org: ${orgId}`);
      res.status(200).json({ ok: true });
    });
  } catch (error) {
    console.error("saveAutoRechargeSettings:", error);
    res.status(500).json({ error: "Failed to save auto-recharge settings" });
  }
});

/**
 * Read auto-recharge preferences (and whether a card is on file).
 */
export const getAutoRechargeSettings = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const settings = await getOrgAutoRechargeSettingsForApi(getActiveOrgId());
      res.status(200).json(settings);
    });
  } catch (error) {
    console.error("getAutoRechargeSettings:", error);
    res.status(500).json({ error: "Failed to get auto-recharge settings" });
  }
});

/**
 * Preview a subscription change (proration)
 */
export const previewSubscriptionChange = onRequest(
  { cors: true, region: REGION, secrets: ["STRIPE_API_KEY", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { newPlanId, newExtraBlocks } = req.body as {
          newPlanId: SubscriptionPlanId;
          newExtraBlocks: number;
          billingInterval: "month" | "year";
        };

        const activeOrgId = getActiveOrgId();
        const sub = await getOrgSubscription(activeOrgId);
        const subId = sub?.stripeSubscriptionId;

        const priceId = process.env[`STRIPE_${newPlanId.toUpperCase()}_PRICE_ID`]?.trim();
        if (!priceId) {
          res.status(400).json({ error: `Price ID for plan ${newPlanId} not found` });
          return;
        }

        const oldBaseConvs = PLAN_BASE_CONVERSATIONS[sub?.planId || "free"] ?? 0;
        const newBaseConvs = PLAN_BASE_CONVERSATIONS[newPlanId] ?? 0;
        const oldContracted = oldBaseConvs + (sub?.extraBlocks ?? 0) * 40;
        const newContracted = newBaseConvs + newExtraBlocks * 40;

        const oldRank = PLAN_RANKS[sub?.planId || "free"] ?? 0;
        const newRank = PLAN_RANKS[newPlanId] ?? 0;
        
        // Upgrade if:
        // 1. Moving to a higher tier plan (e.g. Plus -> Pro)
        // 2. Staying on same plan but increasing total contracted conversations (e.g. adding extra blocks)
        const isUpgrade = newRank > oldRank || (newRank === oldRank && newContracted > oldContracted);

        if (!subId || subId.startsWith("manual_")) {
          res.status(200).json({
            proratedAmountCents: 0,
            renewalDate: sub?.currentPeriodEnd?.toMillis() || Date.now(),
            isUpgrade,
            currentConversations: oldContracted,
            newConversations: newContracted,
            newMonthlyPrice: SUBSCRIPTION_BASE_PRICES[newPlanId] + newExtraBlocks * 10,
            newPlanId,
            proratedConversations: 0,
          });
          return;
        }

        const billingInterval = (req.body as any).billingInterval === "year" ? "year" : "month";
        const extraPriceId = getExtraBlocksPriceId(billingInterval);
        
        const newItems = [{ price: priceId, quantity: 1 }];
        if (newExtraBlocks > 0) {
          newItems.push({ price: extraPriceId, quantity: newExtraBlocks });
        }

        const preview = await previewSubscriptionProration(subId, newItems);

        const proratedConvs = isUpgrade
          ? calculateProratedConversations(oldContracted, newContracted, preview.periodEnd * 1000)
          : 0;

        res.status(200).json({
          proratedAmountCents: preview.amountDue,
          renewalDate: preview.periodEnd * 1000,
          isUpgrade,
          currentConversations: oldContracted,
          newConversations: newContracted,
          newMonthlyPrice: SUBSCRIPTION_BASE_PRICES[newPlanId] + (newPlanId === "free" ? 0 : newExtraBlocks * 10),
          newPlanId,
          proratedConversations: proratedConvs,
        });
      });
    } catch (error) {
      console.error("Error previewing subscription change:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to preview subscription change" });
    }
  }
);

/**
 * Update an existing subscription (upgrade/downgrade)
 */
export const updateSubscriptionPlan = onRequest(
  { cors: true, region: REGION, secrets: ["STRIPE_API_KEY", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { newPlanId, newExtraBlocks, billingInterval } = req.body as {
          newPlanId: SubscriptionPlanId;
          newExtraBlocks: number;
          billingInterval: "month" | "year";
        };

        const activeOrgId = getActiveOrgId();
        const sub = await getOrgSubscription(activeOrgId);
        const subId = sub?.stripeSubscriptionId;
        if (!subId || subId.startsWith("manual_")) {
          res.status(400).json({ 
            error: "Your current subscription is manual and cannot be updated directly through Stripe. Please contact support or start a new plan.",
            code: "MANUAL_SUBSCRIPTION"
          });
          return;
        }

        const priceKey = `STRIPE_${newPlanId.toUpperCase()}_PRICE_ID`;
        const priceId = process.env[priceKey]?.trim();
        if (!priceId) {
          res.status(400).json({ error: `Price mapping not found for ${newPlanId}` });
          return;
        }

        const extraPriceId = getExtraBlocksPriceId(billingInterval);
        
        const newItems = [{ price: priceId, quantity: 1 }];
        if (newExtraBlocks > 0) {
          newItems.push({ price: extraPriceId, quantity: newExtraBlocks });
        }

        const oldBaseConvs = PLAN_BASE_CONVERSATIONS[sub.planId] ?? 0;
        const newBaseConvs = PLAN_BASE_CONVERSATIONS[newPlanId] ?? 0;
        const oldContracted = oldBaseConvs + (sub.extraBlocks ?? 0) * 40;
        const newContracted = newBaseConvs + newExtraBlocks * 40;
        const oldRank = PLAN_RANKS[sub.planId] ?? 0;
        const newRank = PLAN_RANKS[newPlanId] ?? 0;
        const isUpgrade = newRank > oldRank || (newRank === oldRank && newContracted > oldContracted);

        const updatedSub = await updateExistingSubscription(
          sub.stripeSubscriptionId,
          newItems,
          isUpgrade
        );

        // Update Firestore subscription record
        const updatedPeriodEnd = (updatedSub as any).items?.data?.[0]?.current_period_end ?? 0;
        await setOrgSubscription(activeOrgId, {
          planId: newPlanId as SubscriptionPlanId,
          stripeSubscriptionId: updatedSub.id,
          stripeCustomerId: typeof updatedSub.customer === "string" ? updatedSub.customer : updatedSub.customer?.id ?? sub.stripeCustomerId,
          status: "active",
          currentPeriodEnd: admin.firestore.Timestamp.fromMillis(updatedPeriodEnd * 1000),
          extraBlocks: newExtraBlocks,
          billingInterval,
        } as any);

        // For upgrades: grant prorated conversations immediately
        if (isUpgrade && newContracted > oldContracted) {
          const proratedConvs = calculateProratedConversations(
            oldContracted,
            newContracted,
            updatedPeriodEnd * 1000
          );
          if (proratedConvs > 0) {
            await addOrgConversations(
              proratedConvs,
              `Actualización de plan: +${proratedConvs} conversaciones prorrateadas (${sub.planId} → ${newPlanId})`,
              activeOrgId
            );
          }
        }

        res.status(200).json({
          success: true,
          message: isUpgrade ? "Suscripción actualizada correctamente." : "Tu suscripción se actualizará al finalizar el periodo actual.",
        });
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update subscription" });
    }
  }
);

/**
 * Stripe webhook handler for payment events
 * Called by Stripe when payment succeeds, fails, etc.
 */
export const stripeWebhook = onRequest({
  cors: false,
  region: REGION,
  secrets: ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID", SENDGRID_API_KEY],
}, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event;
    try {
      event = constructWebhookEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    console.log(`Stripe webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
      // ── One-time credit top-up ─────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.orgId ?? getActiveOrgId();

        if (session.mode === "subscription") {
          // Subscription checkout: record the subscription in Firestore.
          // Credits are granted via invoice.paid (fired immediately after for the first invoice).
          const planId = (session.metadata?.planId ?? "free") as SubscriptionPlanId;
          const subscriptionId = extractStripeId(session.subscription);
          const customerId = extractStripeId(session.customer);

          await setOrgSubscription(orgId, {
            planId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: "active",
          });
          console.log(`Subscription checkout completed for org ${orgId}, plan ${planId}`);

        } else {
          // One-time payment: add to org balance (same ledger as getConversations / deductOrgConversations)
          const userId = session.metadata?.userId;
          const conversations = parseInt(session.metadata?.conversations || "0", 10);

          if (conversations > 0) {
            const newBalance = await addOrgConversations(
              conversations,
              `Compra de ${conversations} conversaciones${userId ? ` (uid ${userId})` : ""} · session ${session.id}`,
              orgId
            );
            console.log(`Added ${conversations} org conversations for ${orgId}. New balance: ${newBalance}`);
          } else {
            console.warn("One-time checkout completed but missing conversations metadata:", session.metadata);
          }
        }

        try {
          const billing = await extractBillingFromCheckoutSession(session.id);
          if (billing) {
            await mergeOrgStripeBillingFields(
              orgId,
              billing.stripeCustomerId,
              billing.stripeDefaultPaymentMethodId
            );
            console.log(`[stripeWebhook] Saved Stripe customer/PM for org ${orgId}`);
          }
        } catch (billingErr) {
          console.error("[stripeWebhook] extractBillingFromCheckoutSession:", billingErr);
        }
        break;
      }

      // ── Subscription upgrade/downgrade handling ─────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const subMeta = asRecord((sub as any).metadata);
        const orgId: string = (subMeta.orgId as string) || getActiveOrgId();
        const planId = ((subMeta.planId as string) || "free") as SubscriptionPlanId;
        const statusRaw = typeof (sub as any).status === "string" ? (sub as any).status : "active";
        const status =
          statusRaw === "active" || statusRaw === "past_due" || statusRaw === "canceled" || statusRaw === "trialing"
            ? statusRaw
            : "active";
        const currentPeriodEnd = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end;

        if (!orgId) {
          console.error("[stripeWebhook] Missing orgId in metadata for subscription update");
          res.status(400).json({ error: "Missing orgId metadata" });
          return;
        }

        await setOrgSubscription(orgId, {
          planId,
          stripeSubscriptionId: typeof (sub as any).id === "string" ? (sub as any).id : "",
          stripeCustomerId: extractStripeId((sub as any).customer),
          status,
          currentPeriodEnd: currentPeriodEnd
            ? admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000)
            : undefined,
        } as any);
        console.log(`Subscription updated for org ${orgId}: plan=${planId}, status=${status}`);
        break;
      }

      // ── Monthly conversation grant (first payment + all renewals) ────────
      case "invoice.paid": {
        const invoice = asRecord(event.data.object);
        // Only process subscription invoices
        if (!invoice.subscription) {
          console.log("invoice.paid: skipping, no subscription attached");
          break;
        }

        const invoiceId: string = typeof invoice.id === "string" ? invoice.id : "";
        // planId is stored on the subscription metadata
        const subscriptionDetails = asRecord(invoice.subscription_details);
        const subMeta = asRecord(subscriptionDetails.metadata);
        const lines = asRecord(invoice.lines);
        const linesData = Array.isArray(lines.data) ? lines.data : [];
        const line0 = linesData.length > 0 ? asRecord(linesData[0]) : {};
        const line0Meta = asRecord(line0.metadata);

        const planId = ((subMeta.planId as string) || (line0Meta.planId as string) || "free") as SubscriptionPlanId;

        const orgId: string = (subMeta.orgId as string) || getActiveOrgId();
        const extraBlocks = parseInt((subMeta.extraBlocks as string) || "0", 10);

        if (!PLAN_BASE_CONVERSATIONS[planId]) {
          console.warn(`invoice.paid: unknown planId "${planId}" on invoice ${invoiceId}`);
          break;
        }

        await grantSubscriptionConversations(orgId, planId, invoiceId, extraBlocks);
        break;
      }



      // ── Cancellation / expiry ──────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = asRecord(event.data.object);
        const subMeta = asRecord(sub.metadata);
        const orgId: string = (subMeta.orgId as string) || getActiveOrgId();

        await setOrgSubscription(orgId, {
          planId: "free",
          stripeSubscriptionId: typeof sub.id === "string" ? sub.id : "",
          stripeCustomerId: extractStripeId(sub.customer),
          status: "canceled",
        });
        console.log(`Subscription cancelled for org ${orgId}. Reverted to free plan.`);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as { id: string; metadata?: Record<string, string> };
        if (pi.metadata?.source !== "auto_recharge") {
          break;
        }
        const oid = pi.metadata?.orgId;
        const credits = parseInt(pi.metadata?.credits || "0", 10);
        if (!oid || credits <= 0) {
          break;
        }
        await addOrgConversationsForPaymentIntentOnce(oid, credits, pi.id, "Auto-compra conversaciones");
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as any;
        const orgId = pi.metadata?.orgId ?? getActiveOrgId();
        const amount = `${(pi.amount / 100).toFixed(2)}€`;
        console.warn(`Payment failed for org ${orgId}: ${pi.id}, ${pi.last_payment_error?.message}`);
        
        await sendPaymentFailedNotification(orgId, amount).catch(e => 
          console.error("Failed to send payment failed notification:", e)
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

/**
 * Ignore a chat for sync alerts
 */
export const ignoreChatForSync = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { chatId } = req.body;
  if (!chatId) {
    res.status(400).json({ error: "chatId is required" });
    return;
  }

  try {
    await ignoreChat(chatId);
    res.status(200).json({ success: true, message: `Chat ${chatId} ignored` });
  } catch (error) {
    console.error("Error ignoring chat:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Returns the status of each known alert type (last seen + counters).
 * Used by the Alerts UI to show a "system status" panel.
 */
export const getAlertCatalogStatus = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const databaseId = "realestate-whatsapp-bot";
    const orgId = getActiveOrgId();
    const db = getFirestore(admin.app(), databaseId);
    const alertsRef = db.collection("organizations").doc(orgId).collection("system_alerts");
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");

    const scanLimit = Math.max(50, Math.min(1500, parseInt(String(req.query.limit || "500"), 10) || 500));
    const now = Date.now();
    const since24hMs = now - 24 * 60 * 60 * 1000;

    const settingsSnap = await settingsRef.get();
    const enabledByKey = (settingsSnap.exists ? (settingsSnap.data()?.enabledByKey as Record<string, boolean> | undefined) : undefined) || {};
    const lastCheckByKey =
      (settingsSnap.exists ? (settingsSnap.data()?.lastCheckByKey as Record<string, unknown> | undefined) : undefined) || {};

    const snapshot = await alertsRef.orderBy("timestamp", "desc").limit(scanLimit).get();

    type Row = {
      key: string;
      subject: string;
      description: string;
      autoTest: { kind: "event" } | { kind: "schedule"; every: string };
      enabled: boolean;
      lastSeverity: string | null;
      lastMessage: string | null;
      lastTimestampMs: number | null;
      countLast24h: number;
    };

    const rowsByKey = new Map<string, Row>();
    for (const item of ALERT_CATALOG) {
      rowsByKey.set(item.key, {
        key: item.key,
        subject: item.subject,
        description: item.description,
        autoTest: item.autoTest,
        enabled: enabledByKey[item.key] !== false,
        lastSeverity: null,
        lastMessage: null,
        lastTimestampMs: null,
        countLast24h: 0,
      });
    }

    const matchKeyForSubject = (subject: string): string | null => {
      if (!subject) return null;
      if (subject.startsWith("STATUS REPORT:")) return "status_report";
      const exact = ALERT_CATALOG.find(a => a.subject === subject);
      return exact ? exact.key : null;
    };

    snapshot.forEach((snapDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = snapDoc.data() as {
        subject?: string;
        message?: string;
        severity?: string;
        timestamp?: admin.firestore.Timestamp;
      };
      const subject = String(data.subject || "");
      const key = matchKeyForSubject(subject);
      if (!key) return;

      const row = rowsByKey.get(key);
      if (!row) return;

      const tsMs =
        data.timestamp && typeof (data.timestamp as any).toMillis === "function"
          ? (data.timestamp as any).toMillis()
          : null;

      if (tsMs !== null && tsMs >= since24hMs) {
        row.countLast24h += 1;
      }

      if (row.lastTimestampMs === null && tsMs !== null) {
        row.lastTimestampMs = tsMs;
        row.lastSeverity = data.severity ? String(data.severity) : null;
        row.lastMessage = data.message ? String(data.message) : null;
      }
    });

    // Merge in last health-check results (even when no alert was emitted).
    // Important for "whapi_down": when Whapi recovers, we want to show "healthy" + latest test.
    for (const [key, rawCheck] of Object.entries(lastCheckByKey)) {
      const row = rowsByKey.get(key);
      if (!row) continue;
      const check = rawCheck as any;
      const checkedAtMs = typeof check?.checkedAtMs === "number" ? (check.checkedAtMs as number) : null;
      if (checkedAtMs == null) continue;

      const status = typeof check?.status === "string" ? check.status : "";
      const details = check?.details;
      const message =
        status === "ok"
          ? "Health-check OK"
          : status
            ? `Health-check ${status}`
            : "Health-check";

      // "Última vez" should reflect last test time (not last failure alert).
      row.lastTimestampMs = checkedAtMs;
      row.lastMessage = message;
      if (status === "ok") {
        row.lastSeverity = "healthy";
      } else if (status) {
        // For failures, default to warning.
        row.lastSeverity = "warning";
      }

      // If we have details, keep them as lastMessage in a compact way.
      if (details != null) {
        try {
          const shortDetails = typeof details === "string" ? details : JSON.stringify(details);
          row.lastMessage = `${message}: ${shortDetails}`.slice(0, 280);
        } catch {
          // ignore details serialization errors
        }
      }
    }

    const rows = Array.from(rowsByKey.values());
    res.status(200).json({ rows, scanned: snapshot.size });
  } catch (error) {
    console.error("Error in getAlertCatalogStatus:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Enable/disable a specific alert type (by catalog key).
 */
export const setAlertEnabled = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body && typeof req.body === "object") ? (req.body as { key?: string; enabled?: boolean }) : {};
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

    if (!key || enabled === undefined) {
      res.status(400).json({ error: "key and enabled are required" });
      return;
    }

    if (!ALERT_CATALOG.some(a => a.key === key)) {
      res.status(400).json({ error: "Unknown alert key" });
      return;
    }

    const databaseId = "realestate-whatsapp-bot";
    const orgId = getActiveOrgId();
    const db = getFirestore(admin.app(), databaseId);
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");

    await settingsRef.set(
      {
        enabledByKey: {
          [key]: enabled,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ success: true, key, enabled });
  } catch (error) {
    console.error("Error in setAlertEnabled:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Run an on-demand check for a specific alert type.
 * Supports all keys in ALERT_CATALOG.
 */
export const runAlertCheck = onRequest({ cors: true, region: REGION, secrets: [WHAPI_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body && typeof req.body === "object") ? (req.body as { key?: string }) : {};
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) {
      res.status(400).json({ error: "key is required" });
      return;
    }
    if (!ALERT_CATALOG.some(a => a.key === key)) {
      res.status(400).json({ error: "Unknown alert key" });
      return;
    }

    const checkedAt = new Date().toISOString();
    const checkedAtMsBase = Date.now();

    const databaseId = "realestate-whatsapp-bot";
    const orgId = getActiveOrgId();
    const db = getFirestore(admin.app(), databaseId);
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");
    const alertsRef = db.collection("organizations").doc(orgId).collection("system_alerts");

    const persistLastCheck = async (params: { status: "ok" | "error"; details: any; checkedAtMs?: number }) => {
      try {
        await settingsRef.set(
          {
            lastCheckByKey: {
              [key]: {
                status: params.status,
                checkedAt,
                checkedAtMs: params.checkedAtMs ?? checkedAtMsBase,
                details: params.details ?? null,
              },
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Failed to persist lastCheckByKey for runAlertCheck:", e);
      }
    };

    // Guardrail: rate-limit per key to prevent spam.
    try {
      const settingsSnap = await settingsRef.get();
      const lastCheckByKey = (settingsSnap.exists ? (settingsSnap.data()?.lastCheckByKey as Record<string, any> | undefined) : undefined) || {};
      const lastMs = typeof lastCheckByKey?.[key]?.checkedAtMs === "number" ? (lastCheckByKey[key].checkedAtMs as number) : null;
      if (lastMs != null && checkedAtMsBase - lastMs < 60_000) {
        res.status(429).json({
          ok: false,
          key,
          error: "Rate limited: espera 60s antes de volver a ejecutar este check.",
        });
        return;
      }
    } catch (e) {
      // If rate-limit read fails, proceed with the check.
      console.warn("Rate-limit read failed, proceeding:", e);
    }

    if (key === "whapi_down") {
      const whapiStatus = await checkWhapiHealth();
      await persistLastCheck({
        status: whapiStatus.status === "ok" ? "ok" : "error",
        details: { kind: "whapi_health_check", synthetic: false, result: whapiStatus.details ?? null },
      });

      if (whapiStatus.status === "ok") {
        res.status(200).json({ ok: true, key, status: "ok", checkedAt, details: whapiStatus.details });
        return;
      }
      res.status(200).json({ ok: true, key, status: "error", checkedAt, details: whapiStatus.details });
      return;
    }

    if (
      key === "sync_failed" ||
      key === "sync_error" ||
      key === "sync_task_error" ||
      key === "sync_discrepancies"
    ) {
      const startedAt = Date.now();
      try {
        const result = await syncConversationsWithWhapi({ silent: true });
        const ok = (result.errors?.length || 0) === 0;
        const details = {
          kind: "sync_health_check",
          synthetic: true,
          chatsChecked: result.chatsChecked,
          discrepanciesFound: result.discrepanciesFound,
          errors: result.errors,
          durationMs: Date.now() - startedAt,
        };

        await persistLastCheck({ status: ok ? "ok" : "error", details });

        if (ok) {
          res.status(200).json({ ok: true, key, status: "ok", checkedAt, details });
          return;
        }
        res.status(200).json({ ok: true, key, status: "error", checkedAt, details });
        return;
      } catch (e: any) {
        const details = { kind: "sync_health_check", synthetic: true, error: e?.message || String(e), durationMs: Date.now() - startedAt };
        await persistLastCheck({ status: "error", details });

        res.status(200).json({ ok: true, key, status: "error", checkedAt, details });
        return;
      }
    }

    if (key === "manual_test_alert") {
      // Synthetic check: verify we can write a test alert to Firestore (no email).
      const startedAt = Date.now();
      try {
        const docRef = await alertsRef.add({
          subject: "Prueba Manual de Alerta",
          message: "Synthetic check OK (Firestore write).",
          details: { synthetic: true, kind: "manual_test_alert", checkedAt },
          severity: "info",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          resolved: true,
        });
        const details = {
          kind: "manual_test_alert_check",
          synthetic: true,
          wroteToFirestore: true,
          alertId: docRef.id,
          durationMs: Date.now() - startedAt,
        };
        await persistLastCheck({ status: "ok", details });
        res.status(200).json({ ok: true, key, status: "ok", checkedAt, details });
        return;
      } catch (e: any) {
        const details = {
          kind: "manual_test_alert_check",
          synthetic: true,
          wroteToFirestore: false,
          error: e?.message || String(e),
          durationMs: Date.now() - startedAt,
        };
        await persistLastCheck({ status: "error", details });
        res.status(200).json({ ok: true, key, status: "error", checkedAt, details });
        return;
      }
    }

    // Default synthetic check: look for occurrences of this alert in the last 6 hours.
    const windowHours = 6;
    const sinceMs = Date.now() - windowHours * 60 * 60 * 1000;
    const catalogItem = ALERT_CATALOG.find((a) => a.key === key);
    const subject = catalogItem?.subject || "";

    const recentSnapshot = await alertsRef.orderBy("timestamp", "desc").limit(200).get();
    const recentMatches: Array<{ subject: string; message: string; severity: string; timestampMs: number; id: string }> = [];
    recentSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const tsMs =
        data.timestamp && typeof data.timestamp?.toMillis === "function"
          ? (data.timestamp.toMillis() as number)
          : null;
      if (tsMs == null || tsMs < sinceMs) return;
      const s = String(data.subject || "");
      const isMatch = key === "status_report" ? s.startsWith("STATUS REPORT:") : s === subject;
      if (!isMatch) return;
      recentMatches.push({
        id: docSnap.id,
        subject: s,
        message: String(data.message || ""),
        severity: String(data.severity || ""),
        timestampMs: tsMs,
      });
    });

    const ok = recentMatches.length === 0;
    const details = {
      kind: "recent_occurrence_check",
      synthetic: true,
      windowHours,
      sinceMs,
      subject,
      recentCount: recentMatches.length,
      examples: recentMatches.slice(0, 5),
    };
    await persistLastCheck({ status: ok ? "ok" : "error", details });

    res.status(200).json({ ok: true, key, status: ok ? "ok" : "error", checkedAt, details });
  } catch (error) {
    console.error("Error in runAlertCheck:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get audit logs with optional filtering
 */
export const getAuditLogs = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { entityType, entityId, action, userId, isSystemAction, limit } = req.query;

    const allowedEntityTypes: AuditEntityType[] = [
      "lead",
      "conversation",
      "listing",
      "qualified_lead",
      "system_config",
    ];
    const allowedActions: AuditAction[] = [
      "create",
      "update",
      "delete",
      "status_change",
      "bot_toggle",
      "message_sent",
      "qualification_change",
    ];

    const entityTypeValue =
      typeof entityType === "string" && allowedEntityTypes.includes(entityType as AuditEntityType)
        ? (entityType as AuditEntityType)
        : undefined;
    const actionValue =
      typeof action === "string" && allowedActions.includes(action as AuditAction)
        ? (action as AuditAction)
        : undefined;

    const logs = await getAuditLogsFromService({
      entityType: entityTypeValue,
      entityId: entityId as string | undefined,
      action: actionValue,
      userId: userId as string | undefined,
      isSystemAction: isSystemAction === "true" ? true : isSystemAction === "false" ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: String(error) });
  }
});
/**
 * Get all system users from Firebase Auth
 */
export const getSystemUsers = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token); // Verify the requester is authenticated

    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users.map((userRecord) => ({
      uid: userRecord.uid,
      email: userRecord.email || "",
      displayName: userRecord.displayName || "",
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
    }));

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching system users:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ==================== FIRESTORE TRIGGERS (AUDIT LOG) ====================

const DATABASE_ID = "realestate-whatsapp-bot";

/**
 * Helper to detect changes between two document snapshots
 */
function extractDocChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  const b = before || {};
  const a = after || {};

  // Fields to ignore in audit logs to avoid noise
  const ignoreFields = ["lastMessage", "timestamp", "updatedAt", "lastMessageDate", "history", "pendingUserMessages"];

  const allFields = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const field of allFields) {
    if (ignoreFields.includes(field)) continue;

    const valBefore = b[field];
    const valAfter = a[field];

    if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
      changes.push({
        field,
        oldValue: valBefore,
        newValue: valAfter
      });
    }
  }
  return changes;
}

export const onLeadWritten = onDocumentWritten({
  document: "organizations/{orgId}/leads/{leadId}",
  database: DATABASE_ID,
  region: REGION,
  secrets: [WHAPI_TOKEN, TWILIO_AUTH_TOKEN],
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
  const after = event.data?.after.data();

  let action: AuditAction = "update";
  if (!before) action = "create";
  else if (!after) action = "delete";

  const changes = extractDocChanges(before, after);
  if (changes.length === 0 && action === "update") return;

  await recordLeadChange(
    event.params.leadId,
    action,
    changes,
    after?.updatedBy,
    after?.userName
  );

  // Reliable notification path for qualified leads (covers bot + manual qualification).
  const becameQualified = before?.qualificationStatus !== "qualified" && after?.qualificationStatus === "qualified";
  if (!becameQualified) return;

  // Apply listing qualification filters (if any) via AI before notifying agents.
  if (after?.listingCode) {
    try {
      const listing = await fetchListingByCode(after.listingCode);
      if (listing) {
        const hasFilters =
          (listing.operationType === "Alquiler" && (listing.minMonthlyIncome != null || listing.maxPeople != null)) ||
          (listing.operationType === "Venta" && listing.requireMortgageApproved === true);

        if (hasFilters) {
          const summaryForFilter = typeof after.conversationSummary === "string" && after.conversationSummary.trim()
            ? after.conversationSummary
            : `Teléfono: ${after.phone || "N/D"}\nNombre: ${after.name || "Sin nombre"}`;

          const filterResult = await checkLeadPassesFilters({
            conversationSummary: summaryForFilter,
            operationType: listing.operationType,
            minMonthlyIncome: listing.minMonthlyIncome,
            maxPeople: listing.maxPeople,
            requireMortgageApproved: listing.requireMortgageApproved,
          });

          if (!filterResult.pass) {
            console.log(`Lead ${event.params.leadId} filtered out by listing criteria: ${filterResult.reason}`);
            // Update lead to rejected so it surfaces correctly in the UI
            const leadDocRef = event.data?.after.ref;
            if (leadDocRef) {
              await leadDocRef.update({
                qualificationStatus: "rejected",
                rejectionReason: filterResult.reason,
              });
            }
            return;
          }

          console.log(`Lead ${event.params.leadId} passed listing filters: ${filterResult.reason}`);
        }
      }
    } catch (filterError) {
      // Fail-open: if something goes wrong with the filter, proceed with notification
      console.error("Error applying listing qualification filters; proceeding with notification", filterError);
    }
  }

  const config = await getBotConfig();
  const notificationNumberRaw = config.notificationNumbers || NOTIFICATION_NUMBER.value();
  const agentNums = notificationNumberRaw
    ? notificationNumberRaw.split(",").map((n: string) => n.trim()).filter(Boolean)
    : [];
  if (agentNums.length === 0) {
    console.warn("No notification numbers configured; qualified lead summary not sent", event.params.leadId);
    return;
  }

  const summaryText = typeof after?.conversationSummary === "string" && after.conversationSummary.trim()
    ? after.conversationSummary
    : compactMessage([
      "Lead cualificado ✅",
      `Teléfono: ${after?.phone || "N/D"}`,
      `Nombre: ${after?.name || "Sin nombre"}`,
      after?.listingCode ? `Anuncio: ${after.listingCode}` : "",
    ]);
  const templateSid = getAgentNotificationTemplateSid();

  for (const num of agentNums) {
    try {
      await sendAgentNotificationMessage({
        to: num,
        body: summaryText,
        templateSid,
        context: `onLeadWritten:${after?.chatId || event.params.leadId}`,
      });
      console.log(`Notification sent for qualified lead to ${num}`, after?.chatId || event.params.leadId);
    } catch (error) {
      console.error(`Error sending notification to ${num}`, error);
    }
  }
  });
});

export const onConversationWritten = onDocumentWritten({
  document: "organizations/{orgId}/conversations/{chatId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    let action: AuditAction = "update";
    if (!before) action = "create";
    else if (!after) action = "delete";

    // For conversations, we only care about specific changes like botDisabled or qualification
    const changes = extractDocChanges(before, after);

    // Filter changes to only record significant ones to avoid bloat
    const significantFields = ["botDisabled", "qualificationStatus", "isFinished", "name", "tags"];
    const significantChanges = changes.filter(c => significantFields.includes(c.field));

    if (significantChanges.length === 0 && action === "update") return;

    // Determine specific action if it's a toggle
    let finalAction: AuditAction = action;
    if (action === "update") {
      if (significantChanges.find(c => c.field === "botDisabled")) finalAction = "bot_toggle";
      else if (significantChanges.find(c => c.field === "qualificationStatus")) finalAction = "qualification_change";
    }

    await recordConversationChange(
      event.params.chatId,
      finalAction,
      significantChanges,
      after?.updatedBy,
      after?.userName
    );
  });
});


export const onListingWritten = onDocumentWritten({
  document: "organizations/{orgId}/listings/{listingId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    let action: AuditAction = "update";
    if (!before) action = "create";
    else if (!after) action = "delete";

    const changes = extractDocChanges(before, after);
    if (changes.length === 0 && action === "update") return;

    await recordListingChange(
      event.params.listingId,
      action,
      changes,
      after?.updatedBy,
      after?.userName
    );
  });
});

export const onConfigWritten = onDocumentWritten({
  document: "organizations/{orgId}/botConfig/{configId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    const changes = extractDocChanges(before, after);
    if (changes.length === 0) return;

    await recordSystemAction(
      "system_config",
      event.params.configId,
      "update",
      { changes }
    );
  });
});

export const testEmailTemplates = onRequest({ cors: true, region: REGION }, async (req, res) => {
  const type = typeof req.body?.type === "string" ? req.body.type : "";
  const testEmail = typeof req.body?.email === "string" && req.body.email.trim()
    ? req.body.email.trim()
    : "eddyperez1221@gmail.com";

  try {
    if (type === "welcome") {
      await sendWelcomeNotification(testEmail, "User Test", "Proplead Org Test");
    } else if (type === "low_balance") {
      // Mock data for test
      const { formatLowBalanceEmail } = await import("./services/emailTemplates");
      const { sendEmailToUser } = await import("./services/emailService");
      const html = formatLowBalanceEmail({ name: "User Test", balance: 8 });
      await sendEmailToUser({ to: testEmail, subject: "Pausa programada del Agente Virtual ⏳", html });
    } else if (type === "payment_failed") {
      const { formatPaymentFailedEmail } = await import("./services/emailTemplates");
      const { sendEmailToUser } = await import("./services/emailService");
      const html = formatPaymentFailedEmail({ name: "User Test", orgName: "Proplead Org Test", lastPaymentAmount: "39.00€" });
      await sendEmailToUser({ to: testEmail, subject: "Fallo en la renovación 💳", html });
    } else {
      res.status(400).send("Specify type: welcome, low_balance, or payment_failed");
      return;
    }
    
    res.status(200).json({ success: true, message: `Email ${type} sent to ${testEmail}` });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({ error: String(error) });
  }
});
