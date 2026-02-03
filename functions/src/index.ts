import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { ConversationState, HistoryItem, InboundMessage, LeadSummary, OperationType, PendingItem } from "./types";
import {
  fetchListingByCode,
  findLeadByChatId,
  updateLeadChatInfo,
  updateLeadStatus,
  appendConversationRow,
  appendQualifiedLeadRow,
  getActiveStyle,
  getConversationByChatId,
  upsertConversation,
  addPendingMessage,
  updateBufferTask,
  getPendingMessagesAndClear,
  getConversationsForFollowUp,
} from "./services/firestore";
import { sendText } from "./services/whapiClient";
import {
  generateAssistantResponse,
  summarizeLeadDetails,
  extractClientName,
  translateTextToBritishEnglish,
} from "./services/openaiClient";
import { scheduleBufferTask, BUFFER_DELAY_SECONDS } from "./services/cloudTasks";

// Initialize Firebase Admin
admin.initializeApp();

// Region configuration
const REGION = "europe-west1";

// Config params
const NOTIFICATION_NUMBER = defineString("NOTIFICATION_NUMBER");

const LEAD_QUALIFIED_MARKER = "[LEAD_CUALIFICADO]";
const LEAD_NOT_INTERESTED_MARKER = "[LEAD_NO_INTERESADO]";
const SPANISH_LOCAL_NUMBER_REGEX = /^[6789]\d{8}$/;
const INSTAGRAM_PROFILE_URL =
  "https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr";
const BULLET_SYMBOL = "•";
const NO_DATA_LABEL = "Sin datos";
const SUMMARY_EMPTY_TOKENS = new Set(["SINDATOS", "NODATOS", "UNKNOWN", "NA", "N/A", "NOINFO", "NOHAYDATOS"]);

type InitialLanguage = "es" | "en";

// In-memory conversation state (for active conversations)
const conversationStates = new Map<string, ConversationState>();

function normalizeDigitsForCountryCheck(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.replace(/^00+/, "");
}

function isSpanishPhoneNumber(phone?: string): boolean {
  if (!phone) return true;
  const trimmed = phone.trim();
  if (!trimmed) return true;
  const normalizedDigits = normalizeDigitsForCountryCheck(trimmed);
  if (!normalizedDigits) return true;
  if (normalizedDigits.startsWith("34")) return true;
  if (SPANISH_LOCAL_NUMBER_REGEX.test(normalizedDigits)) return true;
  return false;
}

function resolveInitialLanguage(phone?: string): InitialLanguage {
  return isSpanishPhoneNumber(phone) ? "es" : "en";
}

async function getFeaturesForLanguage(features: string, language: InitialLanguage): Promise<string> {
  if (language !== "en") return features;
  try {
    return await translateTextToBritishEnglish(features);
  } catch (error) {
    console.warn("Failed to translate features", error);
    return features;
  }
}

function ensureTimestampMillis(timestamp: number): number {
  if (Number.isNaN(timestamp)) return Date.now();
  if (timestamp < 1_000_000_000_000) return timestamp * 1000;
  return timestamp;
}

// Normalize chatId to handle both @c.us and @s.whatsapp.net formats
function extractPhoneFromChatId(chatId: string): string {
  return chatId.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
}

function getChatIdVariants(chatId: string): string[] {
  const phone = extractPhoneFromChatId(chatId);
  return [
    `${phone}@c.us`,
    `${phone}@s.whatsapp.net`,
  ];
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

function sanitizeSummaryValue(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\s+/g, "").toUpperCase();
  if (SUMMARY_EMPTY_TOKENS.has(normalized)) return undefined;
  return trimmed;
}

function pickSummaryValue(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const sanitized = sanitizeSummaryValue(candidate);
    if (sanitized) return sanitized;
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
    lines.push(`Ingresos: ${pickSummaryValue(summary?.income) ?? NO_DATA_LABEL}`);
    lines.push(`Mascotas: ${pickSummaryValue(summary?.pets) ?? NO_DATA_LABEL}`);
    lines.push(`Fechas: ${pickSummaryValue(summary?.dates) ?? NO_DATA_LABEL}`);
  } else {
    lines.push(`Forma de pago: ${pickSummaryValue(summary?.paymentMethod) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.income) ?? NO_DATA_LABEL}`);
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
    const message1 = compactMessage([
      "Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.",
      "",
      "Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇",
      "",
      INSTAGRAM_PROFILE_URL,
    ]);
    const message2 = compactMessage([
      `You've shown interest in this property ${propertyContext} 👇`,
      "",
      link,
      "",
      "Just to confirm, have you reviewed the property highlights?",
      "",
      formattedFeatures,
      "",
      "* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩",
    ]);
    return [message1, message2];
  }

  const propertyContext = isSale ? "en venta" : "en alquiler";
  const message1 = compactMessage([
    "Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.",
    "",
    "No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇",
    "",
    INSTAGRAM_PROFILE_URL,
  ]);
  const message2 = compactMessage([
    `Te has interesado en esta vivienda ${propertyContext}👇`,
    "",
    link,
    "",
    "Por confirmar, ¿has visto las características?",
    "",
    formattedFeatures,
    "",
    "* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩",
  ]);
  return [message1, message2];
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
  if (!lead) return undefined;

  const listing = await fetchListingByCode(lead.listingCode);
  if (!listing) return undefined;

  const phone = phoneHint ?? lead.phone;
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
    chatId,
    operationType: listing.operationType,
    description: listing.description,
    link: listing.link,
    features: featuresText,
    profitabilityReportAvailable: listing.profitabilityReportAvailable,
    profitabilityReport: listing.profitabilityReport,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
  };

  conversationStates.set(chatId, state);
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

  if (messages.length === 0) {
    console.log("No messages to process for", state.chatId);
    return;
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
    await sendText({ to: state.phone, body: cleanMessage, chatId: state.chatId });
  } catch (error) {
    console.error("Failed to send message via Whapi", error);
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
      const notificationNumber = NOTIFICATION_NUMBER.value();
      if (notificationNumber) {
        try {
          await sendText({ to: notificationNumber, body: notificationBody });
          console.log("Notification sent for qualified lead", state.chatId);
        } catch (error) {
          console.error("Error sending notification", error);
        }
      }

      // Save to qualified leads
      try {
        const resolvedName = pickSummaryValue(leadSummary?.name, state.name) ?? "";
        await appendQualifiedLeadRow({
          phone: state.phone,
          chatId: state.chatId,
          listingCode: state.listingCode,
          conversationSummary: notificationBody,
          name: resolvedName,
          qualified: true,
        });
        console.log("Qualified lead saved", state.chatId);
      } catch (error) {
        console.error("Error saving qualified lead", error);
      }

      // Update lead status to qualified
      try {
        const resolvedName = pickSummaryValue(leadSummary?.name, state.name);
        await updateLeadStatus({
          chatId: state.chatId,
          name: resolvedName,
          qualificationStatus: "qualified",
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

export const webhook = onRequest({ cors: true, region: REGION }, async (req, res) => {
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
            return;
          }

          // If conversation is finished, skip buffering
          if (state.isFinished) {
            console.log("Conversation already finished, skipping buffer", chatId);
            return;
          }

          // Add messages to pending buffer in Firestore
          for (const msg of messages) {
            await addPendingMessage(chatId, {
              text: msg.text,
              timestamp: msg.timestamp,
            });
          }

          // Schedule (or reschedule) the buffer task
          const processUrl = getProcessBufferUrl();
          const { taskName, scheduledTime } = await scheduleBufferTask(chatId, processUrl);

          // Update conversation with task info
          await updateBufferTask(chatId, taskName, scheduledTime);

          console.log(`Buffered ${messages.length} message(s) for ${chatId}, will process at ${new Date(scheduledTime).toISOString()}`);
        } catch (error) {
          console.error("Error buffering messages for", chatId, error);
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
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Process buffered messages - called by Cloud Tasks after buffer delay expires
 */
export const processBuffer = onRequest({ cors: true, region: REGION }, async (req, res) => {
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
    // Return 500 so Cloud Tasks can retry if configured
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export const newLead = onRequest({ cors: true, region: REGION }, async (req, res) => {
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

  let listingData;
  try {
    listingData = await fetchListingByCode(listingCode);
  } catch (error) {
    console.error("Error fetching listing", error);
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

  const initialHistory: HistoryItem[] = [];
  let chatId: string | undefined;

  try {
    for (let i = 0; i < initialMessages.length; i += 1) {
      const body = initialMessages[i];
      const result = await sendText({ to: phone, body, chatId });
      // Use returned chatId if available, otherwise generate one
      if (result.chatId) {
        chatId = result.chatId;
      } else if (!chatId) {
        // Generate chatId in WhatsApp format if Whapi doesn't return it
        chatId = `${phone}@c.us`;
        console.log("Generated chatId:", chatId);
      }
      initialHistory.push({
        role: "assistant",
        text: body,
        timestamp: Date.now() + i,
      });
    }
  } catch (error) {
    console.error("Error sending initial messages", error);
    res.status(502).json({ error: "No se pudieron enviar los mensajes iniciales", details: error instanceof Error ? error.message : String(error) });
    return;
  }

  // Generate chatId if still not available
  if (!chatId) {
    chatId = `${phone}@c.us`;
    console.log("Messages sent but no chatId returned, using generated:", chatId);
  }

  // Update lead in Firestore
  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
    });
  } catch (error) {
    console.error("Error updating lead", error);
  }

  // Create conversation state
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

  conversationStates.set(chatId, state);

  // Save to Firestore
  await upsertConversation(chatId, state);

  res.status(200).json({ chatId });
});

export const healthz = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  res.status(200).json({ status: "ok" });
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
          ? "¿Has podido revisar la información? Cuéntame si te interesa y coordinamos visita. :)"
          : "Hi! Just checking if you had a chance to look at the property info. Let me know if you're interested! :)";

        console.log(`Sending follow-up to ${state.phone} (${state.chatId})`);

        // Send the message
        await sendText({ to: state.phone, body: followUpMessage, chatId: state.chatId });

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
