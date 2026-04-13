import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { AuditAction, AuditEntityType, ConversationState, HistoryItem, InboundMessage, LeadSummary, ListingRow, OperationType, PendingItem } from "./types";
import {
  fetchListingByCode,
  listActiveListingsForResolution,
  findLeadByChatId,
  findLeadByPhone,
  updateLeadChatInfo,
  updateLeadStatus,
  createPendingCallLead,
  updateLeadListingByChatId,
  appendConversationRow,

  getActiveStyle,
  getConversationByChatId,
  getConversationByPhoneAndListing,
  upsertConversation,
  addPendingMessage,
  updateBufferTask,
  getPendingMessagesAndClear,
  getConversationsForFollowUp,
  ignoreChat,
  getAlertCountSince,
  markLeadAsResponded,
  getResponseRateStats,
  getAllLeadsWithChatId,
  updateLeadAnalysis,
  upsertCallIntent,
} from "./services/firestore";
import { checkWhapiHealth } from "./services/whapiClient";
import { sendText as whapiSendText } from "./services/whapiClient";
import {
  sendTextMessage,
  sendInitialTemplateMessage,
  sendAgentNotificationMessage,
  getActiveProvider as getActiveProviderFn,
} from "./services/messagingProvider";
import { createContentTemplate } from "./services/twilioClient";
import {
  classifyConfirmDeny,
  resolveListingWithAgent,
  generateAssistantResponse,
  summarizeLeadDetails,
  extractClientName,
  translateTextToBritishEnglish,
  checkLeadPassesFilters,
} from "./services/openaiClient";
import { scheduleBufferTask, scheduleImmediateHttpTask, BUFFER_DELAY_SECONDS } from "./services/cloudTasks";
import { sendAlert, sendHealthReport } from "./services/alertService";
import { ALERT_CATALOG } from "./services/alertCatalog";
import { syncConversationsWithWhapi, retryFailedMessages, queueFailedMessage } from "./services/conversationSyncService";
import { ADMIN_TEMPLATE_TOKEN, OPENAI_API_KEY, TWILIO_AUTH_TOKEN, WHAPI_TOKEN } from "./secrets";
import {
  addOrgCredits,
  addOrgCreditsForPaymentIntentOnce,
  getOrgAutoRechargeSettingsForApi,
  getOrgCredits,
  getOrgStripeCustomerId,
  mergeOrgStripeBillingFields,
  saveOrgAutoRechargeSettings,
} from "./services/creditsService";
import { getAuditLogs as getAuditLogsFromService, recordLeadChange, recordConversationChange, recordListingChange, recordSystemAction } from "./services/auditService";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  extractBillingFromCheckoutSession,
  getCreditPackages,
  constructWebhookEvent,
  createBillingPortalSession as createBillingPortalSessionService,
} from "./services/stripeService";
import {
  getOrgSubscription,
  setOrgSubscription,
  grantSubscriptionCredits,
  SUBSCRIPTION_CREDITS,
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

// Region configuration
const REGION = "europe-west1";

// Organisation identifier (single-tenant for now)
const ORG_ID = "org_paco_granados";

// Config params
const NOTIFICATION_NUMBER = defineString("NOTIFICATION_NUMBER");
const VOICE_AUDIO_1_URL = defineString("VOICE_AUDIO_1_URL");
const VOICE_AUDIO_2_URL = defineString("VOICE_AUDIO_2_URL");
const TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_ES = defineString("TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_ES");
const TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_EN = defineString("TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_EN");
const TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION = defineString("TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION");

const LEAD_QUALIFIED_MARKER = "[LEAD_CUALIFICADO]";
const LEAD_NOT_INTERESTED_MARKER = "[LEAD_NO_INTERESADO]";

const CALL_PENDING_LISTING_CODE = "__pending__";
// Keep this aligned with audio durations so WhatsApp is sent right after hangup.
// Current v10 durations: part1 ~6.9s + pause 3s + part2 ~13.9s => ~24s total.
const CALL_HANDOFF_DELAY_SECONDS = 24;

function getAgentNotificationTemplateSid(): string | undefined {
  const sid = TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION.value();
  const normalized = typeof sid === "string" ? sid.trim() : "";
  return normalized || undefined;
}

function buildTwiml(xmlBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${xmlBody}\n</Response>`;
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

async function ensureConversationState(chatId: string, phoneHint?: string): Promise<ConversationState | undefined> {
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

/**
 * Get the URL for the processBuffer function
 * URL format from deployment: https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/processBuffer
 */
function getProcessBufferUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
  return `https://europe-west1-${projectId}.cloudfunctions.net/processBuffer`;
}

function getSendCallHandoffUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
  return `https://europe-west1-${projectId}.cloudfunctions.net/sendCallHandoffMessage`;
}

export const webhook = onRequest(
  { cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN] },
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
          // Ensure we have a valid conversation state
          const state = await ensureConversationState(chatId, messages[0].phone);
          if (!state) {
            console.warn("Could not reconstruct conversation state", chatId);
            await sendAlert("Estado no encontrado", `No se pudo reconstruir el estado para el chat: ${chatId}. Es posible que no haya un lead asociado o los datos del anuncio no existan.`, { chatId, phone: messages[0].phone });
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

          // Schedule (or reschedule) the buffer task
          const processUrl = getProcessBufferUrl();
          const { taskName, scheduledTime } = await scheduleBufferTask(canonicalChatId, processUrl, state.pendingTaskName);

          // Update conversation with task info
          await updateBufferTask(canonicalChatId, taskName, scheduledTime);

          console.log(`Buffered ${messages.length} message(s) for ${canonicalChatId} (via ${chatId}), will process at ${new Date(scheduledTime).toISOString()}`);
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
 * Twilio Voice webhook for call→WhatsApp handoff.
 * Configure your Twilio phone number "A CALL COMES IN" to point to this function's URL.
 *
 * Flow:
 * - Play audio 1
 * - Play audio 2
 * - Hang up
 * - Create pending lead + send WhatsApp (async) after hangup
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
    const audio2 = VOICE_AUDIO_2_URL.value();
    if (!audio1 || !audio2) {
      console.error("VOICE_AUDIO_1_URL / VOICE_AUDIO_2_URL not configured");
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Say>Audio not configured.</Say><Hangup/>`));
      return;
    }

    const chatId = normalizeToCanonicalChatId(fromPhone);

    // CRITICAL: Return TwiML IMMEDIATELY to avoid audio clipping.
    // Do all I/O (lead creation, task scheduling) AFTER sending response.
    res.set("Content-Type", "text/xml");
    res.status(200).send(
      buildTwiml(
        [
          `<Play>${twimlEscape(audio1)}</Play>`,
          `<Pause length="3"/>`,
          `<Play>${twimlEscape(audio2)}</Play>`,
          `<Hangup/>`,
        ].join("\n")
      )
    );

    // Now do all async work without blocking the TwiML response
    setImmediate(async () => {
      // 1) Always schedule WhatsApp independently based on call start time.
      // This avoids missing the message if any non-critical write fails.
      try {
        await scheduleImmediateHttpTask({
          url: getSendCallHandoffUrl(),
          payload: {
            phone: fromPhone,
            chatId,
            agentName: "Paco Granados",
          },
          taskPrefix: "callhandoff",
          taskId: callSid || chatId,
          // Send roughly at the end of call audio from call start.
          delaySeconds: CALL_HANDOFF_DELAY_SECONDS,
        });
      } catch (error) {
        console.error("voiceWebhook failed scheduling handoff task", error);
      }

      // 2) Persist optional data independently (should not block messaging).
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
 * Cloud Tasks target: sends the post-call WhatsApp message via Whapi (Spanish).
 * Required because voice webhook must respond immediately to avoid awkward pauses/cut audio.
 */
export const sendCallHandoffMessage = onRequest({ cors: true, region: REGION }, async (req, res) => {
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

  try {
    // Whapi expects international number without plus sign; `phone` should already be digits.
    await whapiSendText({
      to: phone,
      chatId: chatId || normalizeToCanonicalChatId(phone),
      body: buildCallInitialWhatsAppMessageEs(agentName),
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
export const processBuffer = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
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

    const { chatId } = req.body as { chatId?: string };

    if (!chatId) {
      console.error("No chatId provided in request body");
      res.status(400).json({ error: "chatId is required" });
      return;
    }

    console.log(`Processing buffered messages for chatId: ${chatId}`);

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
      console.error(`Could not get conversation state for ${chatId}`);
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
    if (provider === "twilio") {
      const agentName = listingData.agentName || "Paco";
      const formattedFeatures = formatFeaturesList(featuresText, initialLanguage);
      const sanitizedFeatures = formattedFeatures.replace(/\n/g, " | ");

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

  let chatId: string = normalizeToCanonicalChatId(phone);
  const listingAddress =
    [listingData.street, listingData.address].filter(Boolean).join(", ").trim() || listingData.address;

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

  const initialHistory: HistoryItem[] = [];
  const agentName = listingData.agentName || "Paco";

  try {
    const provider = await getActiveProviderFn();
    if (provider === "twilio") {
      const confirmTemplateSid =
        initialLanguage === "en"
          ? TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_EN.value()
          : TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_ES.value();
      if (!confirmTemplateSid) {
        throw new Error(`Missing Twilio confirm template SID for language ${initialLanguage}`);
      }

      const result = await sendInitialTemplateMessage({
        to: phone,
        chatId,
        language: initialLanguage,
        templateSid: confirmTemplateSid,
        variables: {
          "1": leadName || "Hola",
          "2": agentName,
          "3": listingData.link,
        },
      });

      if (result.chatId && result.chatId !== chatId) {
        chatId = result.chatId;
      }

      const templateText =
        initialLanguage === "en"
          ? `Hi ${leadName || ""}${leadName ? "," : ""} I'm Marcos, ${agentName}'s virtual assistant.\n` +
            `You contacted us on Idealista about this property: ${listingData.link}\n` +
            `Is that correct? (Reply: Yes / No)`
          : `Hola ${leadName || ""}${leadName ? "," : ""} soy Marcos, el asistente virtual de ${agentName}, encantado.\n` +
            `Nos has contactado en idealista por esta vivienda: ${listingData.link}\n` +
            `¿Es correcto? (Responde: Sí / No)`;
      initialHistory.push({ role: "assistant", text: templateText, timestamp: Date.now() });
    } else {
      const body =
        initialLanguage === "en"
          ? `Hi ${leadName || ""}${leadName ? "," : ""} I'm Marcos, ${agentName}'s virtual assistant.\n\n` +
            `You contacted us on Idealista about this property: ${listingData.link}\n\n` +
            `Is that correct? (Reply: Yes / No)`
          : `Hola ${leadName || ""}${leadName ? "," : ""} soy Marcos, el asistente virtual de ${agentName}, encantado.\n\n` +
            `Nos has contactado en idealista por esta vivienda: ${listingData.link}\n\n` +
            `¿Es correcto? (Responde: Sí / No)`;
      const result = await sendTextMessage({ to: phone, body, chatId });
      if (result.chatId && result.chatId !== chatId) chatId = result.chatId;
      initialHistory.push({ role: "assistant", text: body, timestamp: Date.now() });
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
      flowStep: "idealista_confirm",
      botDisabled: false,
    };

    await upsertConversation(chatId, { ...state, type: "lead", idealistaDescription: listingData.idealistaDescription || "" });
    conversationStates.set(chatId, state);
    return { ok: false, kind: "send_failed", chatId, details, initialHistory, featuresText };
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
    flowStep: "idealista_confirm",
    botDisabled: false,
    name: leadName,
  };

  conversationStates.set(chatId, { ...state, type: "lead" });
  await upsertConversation(chatId, { ...state, type: "lead", idealistaDescription: listingData.idealistaDescription || "" });

  return { ok: true, chatId, initialHistory, featuresText };
}

export const newLead = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, WHAPI_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const phone = typeof req.body?.telefono === "string" ? req.body.telefono.trim() : "";
  const listingCode = typeof req.body?.anuncio === "string" ? req.body.anuncio.trim() : "";
  const leadName = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const languageNorm = language === "en" ? "en" : language === "es" ? "es" : "";

  if (!phone || !listingCode) {
    res.status(400).json({ error: "telefono y anuncio son obligatorios" });
    return;
  }

  // Check if conversation already exists for this phone and listing and is still open
  const existingConv = await getConversationByPhoneAndListing(phone, listingCode);
  if (existingConv && !existingConv.isFinished) {
    console.log(`Lead ${phone} already has an open conversation for ${listingCode}. Sending returning message.`);

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

      // Update in-memory cache
      conversationStates.set(existingConv.chatId, {
        ...existingConv,
        history: updatedHistory,
      });

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
      // If error sending returning message, we could continue to normal flow, 
      // but usually if one fails, the others will too.
    }
  }

  let listingData: ListingRow | null;
  try {
    listingData = await fetchListingByCode(listingCode);
  } catch (error) {
    console.error("Error fetching listing", error);
    await sendAlert("NewLead Error", `Error al buscar anuncio ${listingCode}`, {
      error: error instanceof Error ? error.message : String(error),
      phone,
      listingCode
    });
    res.status(500).json({ error: "Error consultando datos del anuncio" });
    return;
  }

  if (!listingData) {
    res.status(404).json({ error: "Anuncio no encontrado" });
    return;
  }

  const pipeline = await runIdealistaConfirmPipeline({
    phone,
    listingCode,
    listingData,
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

/**
 * One-shot helper to create Twilio Content templates used by this bot.
 * You will still need to submit them for WhatsApp approval in Twilio manually.
 *
 * Security: requires `?token=...` matching ADMIN_TEMPLATE_TOKEN.
 */
export const createTwilioTemplates = onRequest({ cors: true, region: REGION, secrets: [ADMIN_TEMPLATE_TOKEN] }, async (req, res) => {
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

    res.status(200).json({
      idealistaConfirm: idealistaConfirm.contentSid,
      idealistaConfirmEn: idealistaConfirmEn.contentSid,
      note: "Envía estos ContentSid a WhatsApp para aprobación en Twilio y configura TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_ES / TWILIO_TEMPLATE_SID_IDEALISTA_CONFIRM_EN.",
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
    const orgId = "org_paco_granados";
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

export const testAlert = onRequest({ cors: true, region: REGION }, async (_req, res) => {
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
 * Get available credit packages
 */
export const getPackages = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  try {
    const packages = getCreditPackages();
    res.status(200).json({ packages });
  } catch (error) {
    console.error("Error getting packages:", error);
    res.status(500).json({ error: "Failed to get packages" });
  }
});

/**
 * Get user's credit balance
 * Requires Authorization header with Firebase ID token
 */
export const getCredits = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    // Return organization-level credit balance
    const balance = await getOrgCredits();
    res.status(200).json({ balance });
  } catch (error) {
    console.error("Error getting credits:", error);
    res.status(500).json({ error: "Failed to get credits" });
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
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);

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
        ORG_ID,
        planId,
        lineItems,
        extraBlocks,
        successUrl,
        cancelUrl
      );

      res.status(200).json({ sessionId: session.sessionId, url: session.url });
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
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);

    const sub = await getOrgSubscription(ORG_ID);

    if (!sub) {
      res.status(200).json({ planId: "free", status: "active", currentPeriodEnd: null, contractedConversations: SUBSCRIPTION_CREDITS["free"] });
      return;
    }

    const baseCredits = SUBSCRIPTION_CREDITS[sub.planId] ?? 0;
    const contractedConversations = baseCredits + (sub.extraBlocks ?? 0) * 40;

    res.status(200).json({
      planId: sub.planId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      contractedConversations,
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
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
      const { returnUrl } = req.body as { returnUrl?: string };
      if (!returnUrl) {
        res.status(400).json({ error: "returnUrl is required" });
        return;
      }
      const customerId = await getOrgStripeCustomerId(ORG_ID);
      if (!customerId) {
        res.status(400).json({ error: "No Stripe customer found for this organization" });
        return;
      }
      const session = await createBillingPortalSessionService(ORG_ID, customerId, returnUrl);
      res.status(200).json({ url: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create billing portal session" });
    }
  }
);

/**
 * Create a Stripe Checkout session for purchasing credits
 */
export const createStripeCheckout = onRequest({ cors: true, region: REGION, secrets: ["STRIPE_API_KEY"] }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
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

    const existingCustomerId = await getOrgStripeCustomerId(ORG_ID);
    const session = await createCheckoutSession(
      userId,
      ORG_ID,
      packageId,
      successUrl,
      cancelUrl,
      existingCustomerId ?? undefined,
      quantity
    );

    res.status(200).json({
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create checkout session" });
  }
});

/**
 * Persist auto-recharge preferences for the org.
 */
export const saveAutoRecharge = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);

    const body = req.body as {
      enabled?: boolean;
      thresholdCredits?: number;
      rechargeCredits?: number;
    };
    if (typeof body.enabled !== "boolean") {
      res.status(400).json({ error: "enabled (boolean) is required" });
      return;
    }

    await saveOrgAutoRechargeSettings(ORG_ID, {
      enabled: body.enabled,
      thresholdCredits: typeof body.thresholdCredits === "number" ? body.thresholdCredits : 20,
      rechargeCredits: typeof body.rechargeCredits === "number" ? body.rechargeCredits : 100,
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("saveAutoRecharge:", error);
    res.status(500).json({ error: "Failed to save auto-recharge settings" });
  }
});

/**
 * Read auto-recharge preferences (and whether a card is on file).
 */
export const getAutoRecharge = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);

    const settings = await getOrgAutoRechargeSettingsForApi(ORG_ID);
    res.status(200).json(settings);
  } catch (error) {
    console.error("getAutoRecharge:", error);
    res.status(500).json({ error: "Failed to get auto-recharge settings" });
  }
});

/**
 * Stripe webhook handler for payment events
 * Called by Stripe when payment succeeds, fails, etc.
 */
export const stripeWebhook = onRequest({
  cors: false,
  region: REGION,
  secrets: ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID"],
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
        const orgId = session.metadata?.orgId ?? ORG_ID;

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
          // One-time payment: add to org balance (same ledger as getCredits / deductOrgCredits)
          const userId = session.metadata?.userId;
          const credits = parseInt(session.metadata?.credits || "0", 10);

          if (credits > 0) {
            const newBalance = await addOrgCredits(
              credits,
              `Compra de ${credits} créditos${userId ? ` (uid ${userId})` : ""} · session ${session.id}`,
              orgId
            );
            console.log(`Added ${credits} org credits for ${orgId}. New balance: ${newBalance}`);
          } else {
            console.warn("One-time checkout completed but missing credits metadata:", session.metadata);
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

      // ── Monthly credit grant (first payment + all renewals) ────────
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

        const orgId: string = (subMeta.orgId as string) || ORG_ID;
        const extraBlocks = parseInt((subMeta.extraBlocks as string) || "0", 10);

        if (!SUBSCRIPTION_CREDITS[planId]) {
          console.warn(`invoice.paid: unknown planId "${planId}" on invoice ${invoiceId}`);
          break;
        }

        await grantSubscriptionCredits(orgId, planId, invoiceId, extraBlocks);
        break;
      }

      // ── Plan changes (upgrade / downgrade) ────────────────────────
      case "customer.subscription.updated": {
        const sub = asRecord(event.data.object);
        const subMeta = asRecord(sub.metadata);
        const orgId: string = (subMeta.orgId as string) || ORG_ID;
        const planId = ((subMeta.planId as string) || "free") as SubscriptionPlanId;
        const statusRaw = typeof sub.status === "string" ? sub.status : "active";
        const status =
          statusRaw === "active" || statusRaw === "past_due" || statusRaw === "canceled" || statusRaw === "trialing"
            ? statusRaw
            : "active";
        const currentPeriodEnd = sub.current_period_end as number | undefined;

        await setOrgSubscription(orgId, {
          planId,
          stripeSubscriptionId: typeof sub.id === "string" ? sub.id : "",
          stripeCustomerId: extractStripeId(sub.customer),
          status,
          currentPeriodEnd: currentPeriodEnd
            ? admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000)
            : undefined,
        });
        console.log(`Subscription updated for org ${orgId}: plan=${planId}, status=${status}`);
        break;
      }

      // ── Cancellation / expiry ──────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = asRecord(event.data.object);
        const subMeta = asRecord(sub.metadata);
        const orgId: string = (subMeta.orgId as string) || ORG_ID;

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
        await addOrgCreditsForPaymentIntentOnce(oid, credits, pi.id, "Auto-compra créditos");
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.warn("Payment failed:", paymentIntent.id, paymentIntent.last_payment_error?.message);
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
    const orgId = "org_paco_granados";
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
    const orgId = "org_paco_granados";
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
    const orgId = "org_paco_granados";
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

  const notificationNumberRaw = NOTIFICATION_NUMBER.value();
  const agentNums = notificationNumberRaw
    ? notificationNumberRaw.split(",").map((n) => n.trim()).filter(Boolean)
    : [];
  if (agentNums.length === 0) {
    console.warn("No NOTIFICATION_NUMBER configured; qualified lead summary not sent", event.params.leadId);
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

export const onConversationWritten = onDocumentWritten({
  document: "organizations/{orgId}/conversations/{chatId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
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


export const onListingWritten = onDocumentWritten({
  document: "organizations/{orgId}/listings/{listingId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
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

export const onConfigWritten = onDocumentWritten({
  document: "organizations/{orgId}/botConfig/{configId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
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

export * from "./calendlyWebhook";
