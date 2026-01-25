import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { ConversationState, HistoryItem, InboundMessage, LeadSummary, TipoOperacion } from "./types";
import {
  fetchAnuncioById,
  findLeadByChatId,
  updateLeadChatInfo,
  appendConversationRow,
  appendCualificadoRow,
  getActiveStyle,
  getConversacionByChatId,
  upsertConversacion,
} from "./services/firestore";
import { sendText } from "./services/whapiClient";
import {
  generateAssistantResponse,
  summarizeLeadDetails,
  extractClientName,
  translateTextToBritishEnglish,
} from "./services/openaiClient";

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

function normalizeDigitsForCountryCheck(telefono: string): string {
  const digitsOnly = telefono.replace(/\D/g, "");
  return digitsOnly.replace(/^00+/, "");
}

function isSpanishPhoneNumber(telefono?: string): boolean {
  if (!telefono) return true;
  const trimmed = telefono.trim();
  if (!trimmed) return true;
  const normalizedDigits = normalizeDigitsForCountryCheck(trimmed);
  if (!normalizedDigits) return true;
  if (normalizedDigits.startsWith("34")) return true;
  if (SPANISH_LOCAL_NUMBER_REGEX.test(normalizedDigits)) return true;
  return false;
}

function resolveInitialLanguage(telefono?: string): InitialLanguage {
  return isSpanishPhoneNumber(telefono) ? "es" : "en";
}

async function getCaracteristicasForLanguage(caracteristicas: string, language: InitialLanguage): Promise<string> {
  if (language !== "en") return caracteristicas;
  try {
    return await translateTextToBritishEnglish(caracteristicas);
  } catch (error) {
    console.warn("Failed to translate characteristics", error);
    return caracteristicas;
  }
}

function ensureTimestampMillis(timestamp: number): number {
  if (Number.isNaN(timestamp)) return Date.now();
  if (timestamp < 1_000_000_000_000) return timestamp * 1000;
  return timestamp;
}

function cleanCaracteristica(line: string): string {
  return line.replace(/^[\u2022•*\-]+\s*/u, "").trim();
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

function splitCaracteristicas(caracteristicas: string): string[] {
  const normalized = caracteristicas.replace(/\r\n/g, "\n").trim();
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
  const lines = ["Lead cualificado ✅", `Teléfono: ${state.telefono}`];
  const resolvedName = pickSummaryValue(summary?.nombre, state.nombre);
  lines.push(`Nombre: ${resolvedName ?? NO_DATA_LABEL}`);
  if (state.descripcion) lines.push(`Propiedad: ${state.descripcion}`);
  lines.push(`Operación: ${state.tipoOperacion}`);

  if (state.tipoOperacion === "Alquiler") {
    lines.push(`Personas: ${pickSummaryValue(summary?.personas) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.ingresos) ?? NO_DATA_LABEL}`);
    lines.push(`Mascotas: ${pickSummaryValue(summary?.mascotas) ?? NO_DATA_LABEL}`);
    lines.push(`Fechas: ${pickSummaryValue(summary?.fechas) ?? NO_DATA_LABEL}`);
  } else {
    lines.push(`Forma de pago: ${pickSummaryValue(summary?.formaPago) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.ingresos) ?? NO_DATA_LABEL}`);
  }

  lines.push(`Disponibilidad visita: ${pickSummaryValue(summary?.disponibilidadVisita) ?? NO_DATA_LABEL}`);
  const notesValue = pickSummaryValue(summary?.notas);
  if (notesValue) lines.push(`Notas: ${notesValue}`);

  return lines.join("\n");
}

function formatCaracteristicasList(caracteristicas: string, language: InitialLanguage): string {
  const items = splitCaracteristicas(caracteristicas).map(cleanCaracteristica).filter(Boolean);
  if (items.length === 0) {
    if (!caracteristicas.trim()) {
      return language === "en"
        ? `${BULLET_SYMBOL} Property details are not available at the moment`
        : `${BULLET_SYMBOL} Información no disponible por el momento`;
    }
    const fallback = cleanCaracteristica(caracteristicas);
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
  tipoOperacion: TipoOperacion,
  enlace: string,
  caracteristicas: string,
  options?: { language?: InitialLanguage }
): string[] {
  const language = options?.language ?? "es";
  const isVenta = tipoOperacion === "Venta";
  const formattedCaracteristicas = formatCaracteristicasList(caracteristicas, language);

  if (language === "en") {
    const propertyContext = isVenta ? "for sale" : "for rent";
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
      enlace,
      "",
      "Just to confirm, have you reviewed the property highlights?",
      "",
      formattedCaracteristicas,
      "",
      "* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩",
    ]);
    return [message1, message2];
  }

  const propertyContext = isVenta ? "en venta" : "en alquiler";
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
    enlace,
    "",
    "Por confirmar, ¿has visto las características?",
    "",
    formattedCaracteristicas,
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
    result.push({ chatId, telefono: from, text, timestamp });
  }
  return result;
}

async function ensureConversationState(chatId: string, telefonoHint?: string): Promise<ConversationState | undefined> {
  // Check in-memory first
  const existing = conversationStates.get(chatId);
  if (existing) return existing;

  // Check Firestore
  const savedConv = await getConversacionByChatId(chatId);
  if (savedConv) {
    conversationStates.set(chatId, savedConv);
    return savedConv;
  }

  // Try to rebuild from lead
  const lead = await findLeadByChatId(chatId);
  if (!lead) return undefined;

  const anuncio = await fetchAnuncioById(lead.anuncio);
  if (!anuncio) return undefined;

  const telefono = telefonoHint ?? lead.telefono;
  const initialLanguage = resolveInitialLanguage(telefono);
  const caracteristicasText = await getCaracteristicasForLanguage(anuncio.caracteristicas, initialLanguage);
  const initialMessages = composeInitialMessages(anuncio.tipoOperacion, anuncio.enlace, caracteristicasText, {
    language: initialLanguage,
  });

  const initialHistory: HistoryItem[] = initialMessages.map((message, index) => ({
    role: "assistant",
    text: message,
    timestamp: Date.now() + index,
  }));

  const state: ConversationState = {
    telefono,
    anuncio: anuncio.anuncio,
    chatId,
    tipoOperacion: anuncio.tipoOperacion,
    descripcion: anuncio.descripcion,
    enlace: anuncio.enlace,
    caracteristicas: caracteristicasText,
    informeRentabilidadDisponible: anuncio.informeRentabilidadDisponible,
    informeRentabilidad: anuncio.informeRentabilidad,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
  };

  conversationStates.set(chatId, state);
  return state;
}

async function processMessage(state: ConversationState, message: InboundMessage): Promise<void> {
  if (state.isFinished) {
    console.log("Conversation already finished, ignoring", state.chatId);
    return;
  }

  // Add user message to history
  const userHistoryItem: HistoryItem = {
    role: "user",
    text: message.text,
    timestamp: message.timestamp,
  };
  state.history.push(userHistoryItem);

  // Try to extract client name if not known
  if (!state.nombre) {
    try {
      const detectedName = await extractClientName(state.history);
      if (detectedName) state.nombre = detectedName;
    } catch (error) {
      console.warn("Failed to extract client name", error);
    }
  }

  // Save conversation snapshot
  await appendConversationRow({
    telefono: state.telefono,
    chatId: state.chatId,
    anuncio: state.anuncio,
    history: state.history,
    nombre: state.nombre,
    cualificado: state.qualificationStatus,
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
    await sendText({ to: state.telefono, body: cleanMessage, chatId: state.chatId });
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
    telefono: state.telefono,
    chatId: state.chatId,
    anuncio: state.anuncio,
    history: state.history,
    nombre: state.nombre,
    cualificado: state.qualificationStatus,
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

      // Save to cualificados
      try {
        const resolvedName = pickSummaryValue(leadSummary?.nombre, state.nombre) ?? "";
        await appendCualificadoRow({
          telefono: state.telefono,
          chatId: state.chatId,
          anuncio: state.anuncio,
          resumenConversacion: notificationBody,
          nombre: resolvedName,
          cualificado: true,
        });
        console.log("Qualified lead saved", state.chatId);
      } catch (error) {
        console.error("Error saving qualified lead", error);
      }
    }
  }
}

// ==================== HTTP FUNCTIONS ====================

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

    console.log(`Processing ${inboundMessages.length} message(s)`);

    await Promise.all(
      inboundMessages.map(async (message) => {
        try {
          const state = await ensureConversationState(message.chatId, message.telefono);
          if (!state) {
            console.warn("Could not reconstruct conversation state", message.chatId);
            return;
          }
          await processMessage(state, message);
        } catch (error) {
          console.error("Error processing message", message.chatId, error);
        }
      })
    );

    res.status(200).json({ received: true, count: inboundMessages.length });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
});

export const newLead = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const telefono = typeof req.body?.telefono === "string" ? req.body.telefono.trim() : "";
  const anuncioId = typeof req.body?.anuncio === "string" ? req.body.anuncio.trim() : "";

  if (!telefono || !anuncioId) {
    res.status(400).json({ error: "telefono y anuncio son obligatorios" });
    return;
  }

  let anuncioData;
  try {
    anuncioData = await fetchAnuncioById(anuncioId);
  } catch (error) {
    console.error("Error fetching anuncio", error);
    res.status(500).json({ error: "Error consultando datos del anuncio" });
    return;
  }

  if (!anuncioData) {
    res.status(404).json({ error: "Anuncio no encontrado" });
    return;
  }

  const initialLanguage = resolveInitialLanguage(telefono);
  const caracteristicasText = await getCaracteristicasForLanguage(anuncioData.caracteristicas, initialLanguage);
  const initialMessages = composeInitialMessages(anuncioData.tipoOperacion, anuncioData.enlace, caracteristicasText, {
    language: initialLanguage,
  });

  const initialHistory: HistoryItem[] = [];
  let chatId: string | undefined;

  try {
    for (let i = 0; i < initialMessages.length; i += 1) {
      const body = initialMessages[i];
      const result = await sendText({ to: telefono, body, chatId });
      // Use returned chatId if available, otherwise generate one
      if (result.chatId) {
        chatId = result.chatId;
      } else if (!chatId) {
        // Generate chatId in WhatsApp format if Whapi doesn't return it
        chatId = `${telefono}@c.us`;
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
    chatId = `${telefono}@c.us`;
    console.log("Messages sent but no chatId returned, using generated:", chatId);
  }

  // Update lead in Firestore
  try {
    await updateLeadChatInfo({
      telefono,
      anuncio: anuncioId,
      chatId,
      tipoOperacion: anuncioData.tipoOperacion,
    });
  } catch (error) {
    console.error("Error updating lead", error);
  }

  // Create conversation state
  const state: ConversationState = {
    telefono,
    anuncio: anuncioId,
    chatId,
    tipoOperacion: anuncioData.tipoOperacion,
    descripcion: anuncioData.descripcion,
    enlace: anuncioData.enlace,
    caracteristicas: caracteristicasText,
    informeRentabilidadDisponible: anuncioData.informeRentabilidadDisponible,
    informeRentabilidad: anuncioData.informeRentabilidad,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
  };

  conversationStates.set(chatId, state);

  // Save to Firestore
  await upsertConversacion(chatId, state);

  res.status(200).json({ chatId });
});

export const healthz = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  res.status(200).json({ status: "ok" });
});
