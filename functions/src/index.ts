import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { AuditAction, ConversationState, HistoryItem, InboundMessage, LeadSummary, ListingRow, OperationType, PendingItem, QualificationStatus } from "./types";
import {
  fetchListingByCode,
  findLeadByChatId,
  findLeadByPhone,
  updateLeadChatInfo,
  updateLeadStatus,
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
  searchListings,
  saveCall,
  findCallByVapiId,
  getAllLeadsWithChatId,
  updateLeadAnalysis,
} from "./services/firestore";
import { checkWhapiHealth } from "./services/whapiClient";
import { sendTextMessage, sendInitialTemplateMessage, getActiveProvider as getActiveProviderFn } from "./services/messagingProvider";
import {
  generateAssistantResponse,
  summarizeLeadDetails,
  extractClientName,
  translateTextToBritishEnglish,
} from "./services/openaiClient";
import { scheduleBufferTask, BUFFER_DELAY_SECONDS } from "./services/cloudTasks";
import { sendAlert, sendHealthReport } from "./services/alertService";
import { syncConversationsWithWhapi, retryFailedMessages, queueFailedMessage } from "./services/conversationSyncService";
import { addCredits, deductOrgCredits, getOrgCredits } from "./services/creditsService";
import { getAuditLogs as getAuditLogsFromService, recordLeadChange, recordConversationChange, recordListingChange, recordSystemAction } from "./services/auditService";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  createCheckoutSession,
  getCreditPackages,
  constructWebhookEvent,
} from "./services/stripeService";
import {
  extractPhoneFromChatId,
  getChatIdVariants,
  ensureTimestampMillis,
  isSpanishPhoneNumber,
  normalizeToCanonicalChatId,
} from "./utils";
import { listCalls } from "./services/vapiService";

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Region configuration
const REGION = "europe-west1";

// Config params
const NOTIFICATION_NUMBER = defineString("NOTIFICATION_NUMBER");

const LEAD_QUALIFIED_MARKER = "[LEAD_CUALIFICADO]";
const LEAD_NOT_INTERESTED_MARKER = "[LEAD_NO_INTERESADO]";

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
      botDisabled: true,
      type: "non-lead",
      tags: ["non-lead"],
      language: resolveInitialLanguage(phone),
    };
    conversationStates.set(chatId, nonLeadState);
    return nonLeadState;
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
      botDisabled: true,
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

  // If bot is disabled, we don't generate an automated response
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

      // Send notification
      const notificationNumberRaw = NOTIFICATION_NUMBER.value();
      if (notificationNumberRaw) {
        const numbers = notificationNumberRaw.split(",").map((n) => n.trim()).filter(Boolean);
        for (const num of numbers) {
          try {
            await sendTextMessage({ to: num, body: notificationBody });
            console.log(`Notification sent for qualified lead to ${num}`, state.chatId);
          } catch (error) {
            console.error(`Error sending notification to ${num}`, error);
          }
        }
      }


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

export const webhook = onRequest({ cors: true, region: REGION, secrets: ["SMTP_PASS"] }, async (req, res) => {
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
});

/**
 * Dedicated webhook for Twilio messages
 * Twilio sends form-urlencoded data we can handle in the same logic
 */
export const twilioWebhook = webhook;

/**
 * Process buffered messages - called by Cloud Tasks after buffer delay expires
 */
export const processBuffer = onRequest({ cors: true, region: REGION, secrets: ["SMTP_PASS"] }, async (req, res) => {
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

export const newLead = onRequest({ cors: true, region: REGION, secrets: ["SMTP_PASS"] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const phone = typeof req.body?.telefono === "string" ? req.body.telefono.trim() : "";
  const listingCode = typeof req.body?.anuncio === "string" ? req.body.anuncio.trim() : "";

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

  // Deduct 2 credits from the organization before proceeding
  const CREDITS_PER_CONVERSATION = 2;
  try {
    await deductOrgCredits(CREDITS_PER_CONVERSATION, `Nueva conversación: ${phone} → ${listingCode}`);
    console.log(`Deducted ${CREDITS_PER_CONVERSATION} credits for new lead ${phone}`);
  } catch (error: any) {
    if (error.message?.includes("insuficientes")) {
      res.status(402).json({ error: "Créditos insuficientes para crear una nueva conversación" });
      return;
    }
    console.error("Error deducting credits", error);
    res.status(500).json({ error: "Error al procesar créditos" });
    return;
  }

  let listingData;
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

  const initialLanguage = resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listingData.features, initialLanguage);
  const initialMessages = composeInitialMessages(listingData.operationType, listingData.link, featuresText, {
    language: initialLanguage,
  });

  // 1. First, ensure the lead is saved in Firestore so we don't lose it if sending fails
  // We use the canonical chatId format to prevent duplicates
  let chatId: string = normalizeToCanonicalChatId(phone);

  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      tags: ["lead"],
    });
    console.log(`Lead record created/updated for ${phone} with temporary chatId: ${chatId}`);
  } catch (error) {
    console.warn("Failed to create preliminary lead record", error);
    // We continue anyway to try to send messages
  }

  // 2. Now try to send the initial messages
  const initialHistory: HistoryItem[] = [];
  try {
    const provider = await getActiveProviderFn();
    if (provider === "twilio") {
      const agentName = listingData.agentName || "Paco";

      const formattedFeatures = formatFeaturesList(featuresText, initialLanguage);

      // Twilio ContentVariables cannot contain newlines (error 21656)
      // Replace newlines with a visual separator that WhatsApp renders well
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

      // Reconstruct the template text for history tracking (v11 format)
      const templateText = initialLanguage === "en"
        ? `Hi, I'm Marcos, the virtual assistant for ${agentName}, it's a pleasure to help you 🙂\n\nYou've shown interest in this property: ${listingData.link}\n\nJust to confirm, have you reviewed the property highlights?\n\n${formattedFeatures}\n\nI look forward to hearing from you.`
        : `Hola, soy Marcos, el asistente virtual de ${agentName}, un placer atenderte 🙂\n\nTe has interesado en esta vivienda: ${listingData.link}\n\nPor confirmar, ¿has visto las características?\n\n${formattedFeatures}\n\nEspero tu respuesta.`;

      initialHistory.push({
        role: "assistant",
        text: templateText,
        timestamp: Date.now(),
      });
    } else {
      // Whapi: send multiple free-form messages as before
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
    console.error("Error sending initial messages", error);

    // Even if sending failed, we save the partial history and state we have
    const state: ConversationState = {
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      description: listingData.description,
      link: listingData.link,
      features: featuresText,
      profitabilityReportAvailable: listingData.profitabilityReportAvailable,
      profitabilityReport: listingData.profitabilityReport,
      history: initialHistory,
      pendingUserMessages: [],
      isFinished: false,
    };

    await upsertConversation(chatId, { ...state, tags: ["lead"], type: "lead" });
    conversationStates.set(chatId, state);

    res.status(502).json({
      error: "No se pudieron enviar los mensajes iniciales (pero el lead ha sido guardado)",
      details: error instanceof Error ? error.message : String(error),
      chatId
    });
    return;
  }

  // 3. Final update of the lead and creation of the conversation state
  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      tags: ["lead"],
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
    features: featuresText,
    profitabilityReportAvailable: listingData.profitabilityReportAvailable,
    profitabilityReport: listingData.profitabilityReport,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
  };

  conversationStates.set(chatId, { ...state, tags: ["lead"], type: "lead" });
  await upsertConversation(chatId, { ...state, tags: ["lead"], type: "lead" });

  res.status(200).json({ chatId, success: true });
});

export const sendMessage = onRequest({ cors: true, region: REGION }, async (req, res) => {
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

export const sendMassMessage = onRequest({ cors: true, region: REGION }, async (req, res) => {
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

export const triggerBot = onRequest({ cors: true, region: REGION }, async (req, res) => {
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

export const healthz = onRequest({ cors: true, region: REGION }, async (_req, res) => {
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
  secrets: ["SMTP_PASS"],
}, async (event) => {
  console.log("Running scheduled health check...");
  const whapiStatus = await checkWhapiHealth();

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
}, async (event) => {
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

export const testAlert = onRequest({ cors: true, region: REGION, secrets: ["SMTP_PASS"] }, async (_req, res) => {
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
  secrets: ["SMTP_PASS"],
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
  secrets: ["SMTP_PASS"],
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
  secrets: ["SMTP_PASS"],
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
        const lastMessage = (conversation as any).lastMessage as FirebaseFirestore.Timestamp | undefined;

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
export const triggerSync = onRequest({ cors: true, region: REGION, secrets: ["SMTP_PASS"] }, async (_req, res) => {
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

    const { packageId, successUrl, cancelUrl } = req.body as {
      packageId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!packageId || !successUrl || !cancelUrl) {
      res.status(400).json({ error: "packageId, successUrl, and cancelUrl are required" });
      return;
    }

    const session = await createCheckoutSession(userId, packageId, successUrl, cancelUrl);

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
 * Stripe webhook handler for payment events
 * Called by Stripe when payment succeeds, fails, etc.
 */
export const stripeWebhook = onRequest({
  cors: false,
  region: REGION,
  secrets: ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET"]
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
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const credits = parseInt(session.metadata?.credits || "0", 10);

        if (userId && credits > 0) {
          const newBalance = await addCredits(
            userId,
            credits,
            session.id,
            `Compra de ${credits} créditos`
          );
          console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`);
        } else {
          console.warn("Checkout completed but missing metadata:", session.metadata);
        }
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
 * Get audit logs with optional filtering
 */
export const getAuditLogs = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { entityType, entityId, action, userId, isSystemAction, limit } = req.query;

    const logs = await getAuditLogsFromService({
      entityType: entityType as any,
      entityId: entityId as string | undefined,
      action: action as any,
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

// ==================== VAPI ENDPOINTS ====================

/**
 * Handle VAPI Tool Calls (Function Calling)
 * Used during the call for dynamic lookups (Inbound property search)
 */
export const vapiApiHandler = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    const { message } = req.body;

    // Check if it's a tool call
    if (message?.type === "tool-calls" || message?.toolCalls) {
      const toolCalls = message.toolCalls || [];
      const results = [];

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === "find_listing") {
          const args = toolCall.function.arguments || {};
          const query = args.query || args.reference;
          const street = args.street;
          const price = args.price ? Number(args.price) : undefined;
          const rooms = args.rooms ? Number(args.rooms) : undefined;

          console.log(`VAPI Tool Call: Searching for listing with: ref="${query}", street="${street}", price="${price}", rooms="${rooms}"`);

          let listing: ListingRow | null = null;
          let multipleResults: ListingRow[] = [];

          // 1. Try search by listing code exactly if provided
          if (query) {
            listing = await fetchListingByCode(query);
          }

          // 2. If not found by code, try by other criteria
          if (!listing && (street || price || rooms)) {
            multipleResults = await searchListings({ street, price, rooms });
            if (multipleResults.length === 1) {
              listing = multipleResults[0];
            }
          }

          if (listing) {
            results.push({
              toolCallId: toolCall.id,
              result: JSON.stringify({
                found: true,
                listingCode: listing.listingCode,
                description: listing.description,
                features: listing.features,
                operationType: listing.operationType,
                link: listing.link,
                rentability: listing.profitabilityReport || "No disponible",
                price: listing.price,
                rooms: listing.rooms,
                address: listing.address,
                m2: listing.m2,
                idealistaDescription: listing.idealistaDescription
              })
            });
          } else if (multipleResults.length > 1) {
            results.push({
              toolCallId: toolCall.id,
              result: JSON.stringify({
                found: false,
                multipleOptions: true,
                count: multipleResults.length,
                options: multipleResults.map((r) => ({
                  listingCode: r.listingCode,
                  address: r.address,
                  price: r.price,
                  rooms: r.rooms
                })),
                message: "He encontrado varias propiedades que coinciden. Por favor, confirma con el cliente cuál de estas es (puedes leerle las direcciones o precios)."
              })
            });
          } else {
            results.push({
              toolCallId: toolCall.id,
              result: JSON.stringify({
                found: false,
                multipleOptions: false,
                message: "No encontré ninguna propiedad con esos datos. Por favor, pide al cliente la referencia que aparece en el panel derecho del anuncio de Idealista, o bien confirma la calle y precio exacto."
              })
            });
          }
        }
      }

      res.status(200).json({ results });
      return;
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("VAPI API Handler Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Handle VAPI Webhooks (Call Status & Analysis)
 * Used to update Firestore when a call ends
 */
// --- Helper Functions ---

/**
 * Robustly extracts details from a VAPI call object, handling different response structures
 */
function extractVapiCallDetails(vCall: any) {
  const analysis = vCall.analysis || {};
  const artifact = vCall.artifact || {};

  // 1. Extract Transcript
  const transcript = vCall.transcript || analysis.transcript || artifact.transcript;

  // 2. Extract Structured Data
  let sd: any = analysis.structuredData || {};

  // If we have structuredOutputs (often in API response), merge them
  const structuredOutputs = artifact.structuredOutputs;
  if (structuredOutputs && typeof structuredOutputs === 'object') {
    for (const key in structuredOutputs) {
      const item = structuredOutputs[key];
      if (item && typeof item === 'object' && item.name) {
        sd[item.name] = item.result;
      }
    }
  }

  // 3. Extract Summary
  let summary = vCall.summary || analysis.summary || artifact.summary;
  if (!summary && sd.notes) {
    summary = sd.notes;
  }

  // 4. Metadata
  const isQualified = sd.is_qualified === true;
  const customerName = sd.name || vCall.customer?.name;
  const listingCode = vCall.assistantOverrides?.variableValues?.LISTING_CODE || sd.listing_code;

  return { transcript, summary, sd, isQualified, customerName, listingCode };
}

export const vapiWebhook = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    const { message } = req.body;

    if (message?.type === "end-of-call-report") {
      const call = message.call;
      const analysis = message.analysis;
      const phone = call.customer?.number;
      const callId = call.id;
      const recordingUrl = call.recordingUrl || call.artifact?.recordingUrl;

      console.log(`VAPI Webhook: Call ended for ${phone}. Status: ${call.status}, Recording: ${recordingUrl}`);

      if (!phone) {
        res.status(200).send();
        return;
      }

      // Use the combined extracting logic to be ultra-safe
      const { transcript, summary, sd, isQualified, customerName, listingCode: extractedListingCode } = extractVapiCallDetails({
        ...call,
        analysis: message.analysis || call.analysis,
        artifact: call.artifact
      });

      // Map VAPI fields to our LeadSummary structure
      const leadSummary: LeadSummary = {
        name: customerName,
        people: sd.people,
        income: sd.income,
        pets: sd.pets,
        paymentMethod: sd.payment_method,
        dates: sd.move_in_date,
        visitAvailability: sd.availability,
        notes: sd.notes || analysis?.summary,
      };

      // 2. Find the lead in Firestore OR create if it's a new lead from inbound
      let lead = await findLeadByPhone(phone);
      let chatId = lead?.chatId || normalizeToCanonicalChatId(phone);
      let listingCode = lead?.listingCode;

      // If for some reason we still don't have a listingCode (inbound call for first time)
      // we try to get it from call variables or our analysis
      if (!listingCode) {
        listingCode = extractedListingCode || call.assistantOverrides?.variableValues?.LISTING_CODE;
      }

      const status: QualificationStatus = isQualified ? "qualified" : "rejected";

      // Prepare state for summary building
      // We need to fetch listing data to have a complete state for buildQualifiedLeadMessage
      let listing = null;
      if (listingCode) {
        listing = await fetchListingByCode(listingCode);
      }

      const tempState: ConversationState = {
        phone,
        chatId,
        listingCode,
        name: customerName,
        operationType: listing?.operationType || "Venta",
        description: listing?.description,
        address: listing?.address,
        history: [], // Not needed for message building
        pendingUserMessages: [],
        isFinished: true,
        qualificationStatus: isQualified,
      };

      const notificationBody = buildQualifiedLeadMessage(tempState, leadSummary) + (recordingUrl ? `\n\nGrabación: ${recordingUrl}` : "");

      // 3. Save to calls collection
      await saveCall({
        phone,
        chatId,
        name: customerName,
        listingCode,
        transcript,
        summary,
        isQualified,
        recordingUrl,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        callId,
        structuredData: sd,
      });

      if (lead) {
        // Update existing lead
        await updateLeadStatus({
          chatId: lead.chatId,
          name: customerName,
          qualificationStatus: status,
          recordings: recordingUrl ? [recordingUrl] : [],
          conversationSummary: isQualified ? notificationBody : undefined,
        });
      } else if (listingCode) {
        // Register new lead from VAPI inbound call
        await updateLeadChatInfo({
          phone,
          listingCode,
          chatId,
          operationType: tempState.operationType || "Venta",
          name: customerName,
          qualificationStatus: status,
          recordings: recordingUrl ? [recordingUrl] : [],
          vapiCallId: callId,
          tags: ["vapi-inbound"],
        });
      }

      // 4. Reconstruct / Update Conversation history
      const historyTranscript = transcript || "Transcripción no disponible";
      const newHistoryItem: HistoryItem = {
        role: "user", // Representing the voice call input
        text: `[LLAMADA FINALIZADA]\n\nTranscripción: ${historyTranscript}\n\nGrabación: ${recordingUrl || "N/A"}`,
        timestamp: Date.now(),
      };

      const existingConv = await getConversationByChatId(chatId);
      const updatedHistory = existingConv ? [...(existingConv.history || [])] : [];
      updatedHistory.push(newHistoryItem);

      await appendConversationRow({
        phone: phone,
        chatId: chatId,
        listingCode: listingCode,
        history: updatedHistory,
        name: customerName,
        qualified: isQualified,
        isFinished: true,
        recordings: recordingUrl ? [recordingUrl] : [],
        vapiCallId: callId,
      });

      // Save qualified status to leads (SOT)
      if (isQualified) {
        const notificationNumberRaw = NOTIFICATION_NUMBER.value();
        if (notificationNumberRaw) {
          const numbers = notificationNumberRaw.split(",").map((n) => n.trim()).filter(Boolean);
          for (const num of numbers) {
            await sendTextMessage({ to: num, body: notificationBody });
          }
        }
      }
    }

    res.status(200).send();
  } catch (error) {
    console.error("VAPI Webhook Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Manually sync historical calls from VAPI to Firestore
 */
export const syncVapiCalls = onRequest({ cors: true, region: REGION }, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    console.log(`Starting VAPI sync for last ${limit} calls...`);

    const vapiCalls = await listCalls(limit);

    if (!Array.isArray(vapiCalls)) {
      throw new Error("Invalid response from VAPI: expected an array of calls");
    }

    let syncedCount = 0;
    let skippedCount = 0;

    for (const vCall of vapiCalls) {
      const callId = vCall.id;

      // Check if call already exists in Firestore to avoid duplicates
      const existingCall = await findCallByVapiId(callId);

      if (existingCall) {
        skippedCount++;
        continue;
      }

      const phone = vCall.customer?.number;
      if (!phone) {
        skippedCount++;
        continue;
      }

      const { transcript, summary, sd, isQualified, customerName, listingCode } = extractVapiCallDetails(vCall);

      // Normalize chatId
      const chatId = normalizeToCanonicalChatId(phone);

      await saveCall({
        phone,
        chatId,
        name: customerName,
        listingCode,
        transcript,
        summary,
        isQualified,
        recordingUrl: vCall.recordingUrl,
        timestamp: vCall.createdAt ? admin.firestore.Timestamp.fromDate(new Date(vCall.createdAt)) : admin.firestore.FieldValue.serverTimestamp(),
        callId,
        structuredData: sd,
      });

      syncedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Sync completed: ${syncedCount} calls synced, ${skippedCount} skipped.`,
      details: { syncedCount, skippedCount }
    });
  } catch (error) {
    console.error("VAPI Sync Error:", error);
    res.status(500).json({ error: "Sync Failed", details: error instanceof Error ? error.message : String(error) });
  }
});

// ==================== FIRESTORE TRIGGERS (AUDIT LOG) ====================

const DATABASE_ID = "realestate-whatsapp-bot";

/**
 * Helper to detect changes between two document snapshots
 */
function extractDocChanges(before: any, after: any): { field: string; oldValue: any; newValue: any }[] {
  const changes: { field: string; oldValue: any; newValue: any }[] = [];
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
