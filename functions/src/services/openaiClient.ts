import OpenAI from "openai";
import { defineString } from "firebase-functions/params";
import { OPENAI_API_KEY } from "../secrets";
import {
  ConversationState,
  HistoryItem,
  LeadSummary,
  BotStyle,
  OperationType,
  ListingForResolution,
  AgentListingCandidate,
  AgentListingResolutionDecision,
} from "../types";
const OPENAI_MODEL = defineString("OPENAI_MODEL");

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

function resolveModel(): string {
  return OPENAI_MODEL.value() || "gpt-5.2";
}

function normalizeStyleModifier(styleModifier: string, language: "es" | "en"): string {
  const baseRulesEn = [
    "- Keep messages short and direct (max 2-3 lines when possible).",
    "- Group related questions in one message when possible.",
    "- Do not repeat information the user just provided.",
    "- Avoid empty filler phrases; stay professional and efficient.",
  ];
  const baseRulesEs = [
    "- Mantén mensajes cortos y directos (máximo 2-3 líneas cuando sea posible).",
    "- Agrupa preguntas relacionadas en un único mensaje cuando sea posible.",
    "- No repitas información que el usuario acaba de dar.",
    "- Evita frases vacías de relleno; sé profesional y eficiente.",
  ];
  const trimmed = (styleModifier || "").trim();
  const selectedBaseRules = language === "en" ? baseRulesEn : baseRulesEs;
  if (!trimmed) return selectedBaseRules.join("\n");
  return `${selectedBaseRules.join("\n")}\n${trimmed}`;
}

function buildLanguagePolicyPrompt(language: "es" | "en"): string {
  if (language === "en") {
    return [
      "LANGUAGE POLICY (STRICT):",
      "- Produce the final reply in English.",
      "- Use natural British English spelling and phrasing.",
      "- Never switch to another language unless the user explicitly asks to continue in that language.",
    ].join("\n");
  }
  return [
    "POLÍTICA DE IDIOMA (ESTRICTA):",
    "- La respuesta final debe estar en español.",
    "- Usa español natural y profesional.",
    "- No cambies a otro idioma salvo petición explícita del usuario.",
  ].join("\n");
}

function buildQualificationPrompt(styleModifier: string, language: "es" | "en" = "es"): string {
  const normalizedStyle = normalizeStyleModifier(styleModifier, language);
  if (language === "en") {
    return `
You are a virtual assistant for a Real Estate Agent. You qualify leads DIRECTLY and EFFICIENTLY.

========================
COMMUNICATION STYLE (VERY IMPORTANT)
========================
${normalizedStyle}

Tools and Scope:
- Do not use external tools.
- Your knowledge is limited to: listing link + address + provided features.
- Do not give legal or financial advice.

Context:
- The user has already received an initial message with the link and basic features.
- Operation type: "{{TIPO_OPERACION}}" ("Sale" or "Rental").

General Rules:
1. If the user asks about a feature, briefly confirm and ask if it works for them.
2. If the user is explicitly NOT interested, say goodbye politely and end the conversation.
3. If the user provides information without you asking, do not ask for it again.

========================
FLOW FOR "Sale"
========================
Objective: Validate interest and payment method.

STEP 1 - NAME:
- If a client name is provided in the "SPECIFIC DATA FOR THIS CONVERSATION" section, you ALREADY know the name → DO NOT ask "Who am I speaking with?" and do not ask for name/surname.
- Only if the name is NOT provided there and the user hasn't introduced themselves, ask: "Who am I speaking with?"
- If they already introduced themselves, DO NOT ask again.

STEP 2 - Features:
- Confirm the features work for them.
- If a Profitability Report is available: send it EXACTLY as provided after confirming interest, and ask if the profitability works for them.

STEP 3 - Payment method:
- Ask: "Would it be a cash purchase or with a mortgage?"
- If mortgage: "Do you already have it granted or do you need help with that?"

STEP 4 - Visit availability:
- BEFORE closing, ask for their BEST AVAILABILITY: "So the agent can call you and confirm the visit, what is your best availability: mornings, afternoons, or doesn't matter?"
- If the user already indicated their availability, DO NOT ask again.
- NEVER confirm a specific time or date. Just collect their preference.

STEP 5 - Closing:
- BEFORE CLOSING: If the name is NOT known (not provided in the conversation data and not introduced by the user), you may ask ONCE for their name. Otherwise, NEVER ask for it again.
- When you have the information (including availability) → natural closing message indicating the agent WILL CALL to CONFIRM the visit + marker.
- NEVER give the impression that the visit is already confirmed or scheduled.

========================
FLOW FOR "Rental"
========================
Objective: Get the tenant profile.

STEP 1 - NAME:
- If a client name is provided in the "SPECIFIC DATA FOR THIS CONVERSATION" section, you ALREADY know the name → DO NOT ask "Who am I speaking with?" and do not ask for name/surname.
- Only if the name is NOT provided there and the user hasn't introduced themselves, ask: "Who am I speaking with?"
- If they already introduced themselves, DO NOT ask again.

STEP 2 - Tenant data (GROUP in 1-2 messages):
- Ask EVERYTHING TOGETHER: "To move forward, I need: How many people will live there? Net monthly income? Move-in date? Any pets?"
- If the user gives partial data, ask ONLY what is missing in the next message.
- DO NOT ask questions one by one.

STEP 3 - Visit availability:
- BEFORE closing, ask for their BEST AVAILABILITY: "So the agent can call you and confirm the visit, what is your best availability: mornings, afternoons, or doesn't matter?"
- If the user already indicated their availability, DO NOT ask again.
- NEVER confirm a specific time or date. Just collect their preference.

STEP 4 - Closing:
- BEFORE CLOSING: If the name is NOT known (not provided in the conversation data and not introduced by the user), you may ask ONCE for their name. Otherwise, NEVER ask for it again.
- When you have: people, income, dates, pets, availability → natural closing message indicating the agent WILL CALL to CONFIRM the visit + marker.
- DO NOT summarize the data before closing.
- NEVER give the impression that the visit is already confirmed or scheduled.

========================
STATUS MARKERS (MANDATORY)
========================
You MUST add a marker at the end of your message when the conversation ends. The marker goes ON A NEW LINE at the end.

MARKER [LEAD_CUALIFICADO]:
- Add it when you have collected all the necessary information and close the conversation.
- The closing message must be NATURAL and CONTEXTUAL. Indicate that the agent will call.
- Regarding visit coordination, NEVER confirm the visit yourself. Only indicate the agent will contact to confirm day and time.
- DO NOT use the same phrase every time. Vary according to context.

MARKER [LEAD_NO_INTERESADO]:
- Add it when the user explicitly indicates they are NOT interested.
- Say goodbye politely.

IF THE CONVERSATION IS STILL IN PROGRESS: Do not add any marker.

========================
FORBIDDEN
========================
- CONFIRMING or giving the impression of confirming a visit time/date (only the agent can do it)
- Saying phrases like "I scheduled the visit for you", "we'll meet on Tuesday", "the visit will be at X"
- Making summaries of what the user said ("To summarize...", "So we have...")
- Repeating data the user just gave
- Empty excessive courtesy phrases
- Asking for data one by one when you can group them
- Continuing the conversation after adding a closing marker
- Inventing features not provided
- Using the SAME closing phrase every time (vary the message)
- Forgetting the marker when you close the conversation
- Putting the marker in the middle of the message (always at the END, on a new line)
`.trim();
  }

  return `
Eres un asistente virtual de un Agente Inmobiliario. Cualificas leads de forma DIRECTA y EFICIENTE.

========================
ESTILO DE COMUNICACIÓN (MUY IMPORTANTE)
========================
${normalizedStyle}

Herramientas y Alcance:
- No uses herramientas externas.
- Tu conocimiento se limita a: enlace del anuncio + dirección + características proporcionadas.
- No des consejos legales ni financieros.

Contexto:
- El usuario ya recibió un mensaje inicial con el enlace y características básicas.
- Tipo de operación: "{{TIPO_OPERACION}}" ("Venta" o "Alquiler").

Reglas Generales:
1. Si el usuario pregunta sobre una característica, confirma brevemente y pregunta si le encaja.
2. Si el usuario NO está interesado explícitamente, despídete cortésmente y termina.
3. Si el usuario da información sin que la pidas, no la vuelvas a pedir.

========================
FLUJO PARA "Venta"
========================
Objetivo: Validar interés y método de pago.

PASO 1 - NOMBRE:
- Si en "DATOS ESPECÍFICOS DE ESTA CONVERSACIÓN" viene un nombre de cliente, YA lo conoces → NO preguntes "¿Con quién hablo?" ni pidas nombre/apellidos.
- Solo si NO viene nombre ahí y el usuario no se ha presentado, pregúntalo: "¿Con quién hablo?"
- Si ya se presentó, NO vuelvas a preguntarlo.

PASO 2 - Características:
- Confirma que le encajan las características.
- Si hay Informe de Rentabilidad disponible: envíalo TAL CUAL tras confirmar interés, y pregunta si le encaja la rentabilidad.

PASO 3 - Método de pago:
- Pregunta: "¿Sería compra al contado o con hipoteca?"
- Si hipoteca: "¿Ya la tienes concedida o necesitas ayuda con eso?"

PASO 4 - Disponibilidad para visitar:
- ANTES de cerrar, pregunta por su MEJOR DISPONIBILIDAD: "Para que el comercial pueda llamarte y confirmar la visita, ¿cuál es tu mejor disponibilidad: mañanas, tardes o te es indiferente?"
- Si el usuario ya indicó su disponibilidad, NO vuelvas a preguntarlo.
- NUNCA confirmes una hora o fecha específica. Solo recoges preferencia.

PASO 5 - Cierre:
- ANTES DE CERRAR: Si el nombre NO es conocido (no viene en los datos de conversación y el usuario no se ha presentado), puedes pedirlo UNA sola vez. Si el nombre ya es conocido, NUNCA lo vuelvas a pedir.
- Cuando tengas la información (incluida disponibilidad) → mensaje de cierre natural indicando que el comercial LLAMARÁ para CONFIRMAR la visita + marcador.
- NUNCA des la impresión de que la visita ya está confirmada o agendada.

========================
FLUJO PARA "Alquiler"
========================
Objetivo: Obtener perfil del inquilino.

PASO 1 - NOMBRE:
- Si en "DATOS ESPECÍFICOS DE ESTA CONVERSACIÓN" viene un nombre de cliente, YA lo conoces → NO preguntes "¿Con quién hablo?" ni pidas nombre/apellidos.
- Solo si NO viene nombre ahí y el usuario no se ha presentado, pregúntalo: "¿Con quién hablo?"
- Si ya se presentó, NO vuelvas a preguntarlo.

PASO 2 - Datos del inquilino (AGRUPA en 1-2 mensajes):
- Pregunta TODO JUNTO: "Para avanzar, necesito: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales? ¿Fecha de entrada? ¿Mascotas?"
- Si el usuario da datos parciales, pregunta SOLO lo que falta en el siguiente mensaje.
- NO hagas preguntas de una en una.

PASO 3 - Disponibilidad para visitar:
- ANTES de cerrar, pregunta por su MEJOR DISPONIBILIDAD: "Para que el comercial pueda llamarte y confirmar la visita, ¿cuál es tu mejor disponibilidad: mañanas, tardes o te es indiferente?"
- Si el usuario ya indicó su disponibilidad, NO vuelvas a preguntarlo.
- NUNCA confirmes una hora o fecha específica. Solo recoges preferencia.

PASO 4 - Cierre:
- ANTES DE CERRAR: Si el nombre NO es conocido (no viene en los datos de conversación y el usuario no se ha presentado), puedes pedirlo UNA sola vez. Si el nombre ya es conocido, NUNCA lo vuelvas a pedir.
- Cuando tengas: personas, ingresos, fechas, mascotas y disponibilidad → mensaje de cierre natural indicando que el comercial LLAMARÁ para CONFIRMAR la visita + marcador.
- NO resumas los datos antes de cerrar.
- NUNCA des la impresión de que la visita ya está confirmada o agendada.

========================
MARCADORES DE ESTADO (OBLIGATORIO)
========================
DEBES añadir un marcador al final de tu mensaje cuando la conversación termine. El marcador va EN UNA LÍNEA NUEVA al final.

MARCADOR [LEAD_CUALIFICADO]:
- Añádelo cuando hayas recopilado toda la información necesaria y cierres la conversación.
- El mensaje de cierre debe ser NATURAL y CONTEXTUAL. Indica que el comercial le llamará.
- En cuanto a coordinación de visita,NUNCA confirmes la visita tú mismo. Solo indicas que el comercial contactará para confirmar día y hora.
- NO uses siempre la misma frase. Varía según el contexto.

MARCADOR [LEAD_NO_INTERESADO]:
- Añádelo cuando el usuario indique explícitamente que NO está interesado.
- Despídete cortésmente.

SI LA CONVERSACIÓN SIGUE EN PROGRESO: No añadas ningún marcador.

========================
PROHIBIDO
========================
- CONFIRMAR o dar impresión de confirmar una hora/fecha de visita (solo el comercial puede hacerlo)
- Decir frases como "te agendo la visita", "quedamos el martes", "la visita será a las X"
- Hacer resúmenes de lo que el usuario dijo ("Para resumir...", "Entonces tenemos...")
- Repetir datos que el usuario acaba de dar
- Frases vacías de cortesía excesiva
- Preguntar datos de uno en uno cuando puedes agrupar
- Seguir la conversación después de añadir un marcador de cierre
- Inventar características no proporcionadas
- Usar la MISMA frase de cierre siempre (varía el mensaje)
- Olvidar el marcador cuando cierras la conversación
- Poner el marcador en medio del mensaje (siempre al FINAL, en línea nueva)
`.trim();
}

function buildInstructions(state: ConversationState, style: BotStyle): string {
  const language = state.targetLanguage || state.language || "es";
  const qualificationPrompt = buildQualificationPrompt(style.promptModifier, language);
  const languagePolicyPrompt = buildLanguagePolicyPrompt(language);

  let operationTypeLabel: string = state.operationType || "Venta";
  if (language === "en") {
    operationTypeLabel = state.operationType === "Alquiler" ? "Rental" : "Sale";
  }

  const template = qualificationPrompt.replace(/\{\{TIPO_OPERACION\}\}/g, operationTypeLabel);
  const parts: string[] = [
    template,
    "========================",
    languagePolicyPrompt,
    "========================",
    language === "en" ? "SPECIFIC DATA FOR THIS CONVERSATION" : "DATOS ESPECÍFICOS DE ESTA CONVERSACIÓN",
    "========================",
    language === "en"
      ? `Client name (already known): ${state.name || "UNKNOWN"}`
      : `Nombre del cliente (ya conocido): ${state.name || "DESCONOCIDO"}`,
    language === "en" ? `Listing link: ${state.link}` : `Enlace del anuncio: ${state.link}`,
    language === "en" ? `Address: ${state.address || "Not specified"}` : `Dirección: ${state.address || "No especificada"}`,
    language === "en" ? `Communicated features: ${state.features}` : `Características comunicadas: ${state.features}`,
    language === "en"
      ? `Idealista description (verbatim, may be long): ${state.idealistaDescription || "Not provided"}`
      : `Descripción de Idealista (texto literal, puede ser largo): ${state.idealistaDescription || "No proporcionada"}`,
    language === "en"
      ? `Profitability report available: ${state.profitabilityReportAvailable ? "TRUE" : "FALSE"}`
      : `Informe de rentabilidad disponible: ${state.profitabilityReportAvailable ? "TRUE" : "FALSE"}`,
  ];

  if (state.profitabilityReportAvailable && state.profitabilityReport) {
    parts.push(language === "en" ? "Profitability Report Text:" : "Texto Informe Rentabilidad:", state.profitabilityReport);
  }

  return parts.join("\n");
}

function buildInputText(history: HistoryItem[]): string {
  return history
    .map((item) => {
      const prefix = item.role === "assistant" ? "[ASISTENTE]:" : "[USUARIO]:";
      return `${prefix} ${item.text}`;
    })
    .join("\n\n");
}

export async function generateAssistantResponse(
  history: HistoryItem[],
  state: ConversationState,
  style: BotStyle
): Promise<string> {
  const model = resolveModel();
  const instructions = buildInstructions(state, style);
  const inputText = buildInputText(history);

  const response = await getClient().responses.create({
    model,
    instructions,
    input: inputText,
    store: false,
    text: { format: { type: "text" } },
  });

  const output = response.output_text;
  if (!output) {
    throw new Error("OpenAI response did not include output_text");
  }

  return output.trim();
}

function looksSpanish(text: string): boolean {
  const lowered = text.toLowerCase();
  if (!/[a-záéíóúñü]/i.test(lowered)) return false;
  if (/[¿¡ñáéíóúü]/i.test(lowered)) return true;
  const tokens = lowered.match(/[a-záéíóúñü]+/gi) || [];
  const strongSpanish = new Set(["vale", "gracias", "mañana", "tarde", "vivienda", "ingresos", "mascota", "comercial"]);
  let score = 0;
  for (const token of tokens) {
    if (strongSpanish.has(token)) score += 1;
  }
  return score >= 1;
}

function looksEnglish(text: string): boolean {
  const lowered = text.toLowerCase();
  if (!/[a-z]/i.test(lowered)) return false;
  const tokens = lowered.match(/[a-z]+/gi) || [];
  const strongEnglish = new Set(["thanks", "listing", "property", "income", "move", "visit", "call", "great", "understood"]);
  let score = 0;
  for (const token of tokens) {
    if (strongEnglish.has(token)) score += 1;
  }
  return score >= 1;
}

export function detectLikelyLanguage(text: string, fallback: "es" | "en"): "es" | "en" {
  const trimmed = (text || "").trim();
  if (!trimmed) return fallback;
  const es = looksSpanish(trimmed);
  const en = looksEnglish(trimmed);
  if (es && !en) return "es";
  if (en && !es) return "en";
  return fallback;
}

export async function enforceOutboundLanguage(params: {
  text: string;
  targetLanguage: "es" | "en";
}): Promise<{ text: string; action: "none" | "translate"; detectedLanguage: "es" | "en" }> {
  const detectedLanguage = detectLikelyLanguage(params.text, params.targetLanguage);
  if (detectedLanguage === params.targetLanguage) {
    return { text: params.text.trim(), action: "none", detectedLanguage };
  }

  const instructions = params.targetLanguage === "en"
    ? "Translate the assistant message to natural British English. Preserve intent, details, and structure. Keep any status marker token such as [LEAD_CUALIFICADO] or [LEAD_NO_INTERESADO] exactly unchanged. Respond only with the translated message."
    : "Traduce el mensaje del asistente a español natural. Conserva intención, detalles y estructura. Mantén cualquier marcador de estado como [LEAD_CUALIFICADO] o [LEAD_NO_INTERESADO] exactamente igual. Responde solo con el mensaje traducido.";
  const response = await getClient().responses.create({
    model: resolveModel(),
    instructions,
    input: params.text,
    store: false,
    text: { format: { type: "text" } },
  });
  const output = response.output_text?.trim();
  if (!output) {
    return { text: params.text.trim(), action: "none", detectedLanguage };
  }
  return { text: output, action: "translate", detectedLanguage };
}

const LEAD_SUMMARY_PROMPT = `
Actúas como analista que prepara un briefing para un agente inmobiliario tras revisar una conversación entre el bot y el lead.

Tu misión es extraer SOLO la información que el cliente ya proporcionó. No inventes datos.

Debes responder EXCLUSIVAMENTE con un JSON válido (sin texto extra ni comentarios) con exactamente estas claves y los tipos indicados:
{
  "name": "",
  "people": "",
  "income": 0, // número entero, suma total de ingresos familiares. Si no se menciona o no hay un valor claro, usa null
  "pets": true, // booleano. true si tiene, false si dijo expresamente que no. null si no se menciona.
  "paymentMethod": "Contado", // EXACTAMENTE "Contado" o "Hipoteca". null si no se menciona.
  "dates": "",
  "visitAvailability": "",
  "notes": ""
}

Reglas:
- Escribe todos los valores de texto en español y en estilo breve.
- Si un dato no se mencionó, usa "" o null según el tipo.
- "people" debe describir cuántas vivirán o su composición familiar.
- "income" debe ser la suma de todos los ingresos en la unidad familiar (SOLO un número). Ej: si dice 1200 y 1300, devuelve 2500.
- "pets" debe ser estrictamente un valor booleano (true/false) o null.
- "paymentMethod" debe ser estrictamente "Contado" o "Hipoteca" o null.
- "dates" resume fecha de entrada y, si aplica, salida.
- "visitAvailability" indica la preferencia del cliente para visitar (mañanas, tardes, indiferente, etc.).
- "notes" recoge cualquier contexto adicional útil (motivaciones, urgencias, etc.).
- No repitas el número de teléfono, ya se envía aparte.
- Prioriza los datos críticos según el tipo de operación.
`.trim();

function buildLeadSummaryInstructions(state: ConversationState): string {
  const focusText =
    state.operationType === "Alquiler"
      ? "Prioriza gente, ingresos, fechas de entrada/salida y mascotas."
      : "Prioriza forma de pago, si tiene hipoteca aprobada y contexto financiero.";

  return [
    LEAD_SUMMARY_PROMPT,
    "",
    `Tipo de operación actual: ${state.operationType || "Venta"}. ${focusText}`,
  ].join("\n");
}

function parseLeadSummaryValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseLeadSummaryNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = parseFloat(value.replace(/[^\d.-]/g, ""));
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

function parseLeadSummaryBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseLeadSummaryPaymentMethod(value: unknown): "Contado" | "Hipoteca" | undefined {
  if (typeof value !== "string") return undefined;
  const str = value.toLowerCase();
  if (str.includes("contado")) return "Contado";
  if (str.includes("hipoteca")) return "Hipoteca";
  return undefined;
}

function parseLeadSummaryResponse(output: string): LeadSummary {
  const trimmed = output.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const jsonCandidate = start !== -1 && end !== -1 && end > start ? trimmed.slice(start, end + 1) : trimmed;

  try {
    const parsed = JSON.parse(jsonCandidate);
    return {
      name: parseLeadSummaryValue(parsed.name),
      people: parseLeadSummaryValue(parsed.people),
      income: parseLeadSummaryNumber(parsed.income),
      pets: parseLeadSummaryBoolean(parsed.pets),
      paymentMethod: parseLeadSummaryPaymentMethod(parsed.paymentMethod),
      dates: parseLeadSummaryValue(parsed.dates),
      visitAvailability: parseLeadSummaryValue(parsed.visitAvailability),
      notes: parseLeadSummaryValue(parsed.notes),
    };
  } catch {
    console.warn("Failed to parse lead summary JSON", jsonCandidate);
    return {};
  }
}

export async function summarizeLeadDetails(state: ConversationState): Promise<LeadSummary> {
  const hasUserMessages = state.history.some((item) => item.role === "user" && item.text.trim());
  if (!hasUserMessages) {
    return {};
  }

  const instructions = buildLeadSummaryInstructions(state);
  const inputText = buildInputText(state.history);

  const response = await getClient().responses.create({
    model: resolveModel(),
    instructions,
    input: inputText,
    store: false,
    text: { format: { type: "text" } },
  });

  const output = response.output_text;
  if (!output) {
    throw new Error("OpenAI summary response did not include output_text");
  }

  return parseLeadSummaryResponse(output);
}

const NAME_EXTRACTION_INSTRUCTIONS = `
Eres un asistente que revisa el historial de una conversación entre un bot inmobiliario y un cliente.

Objetivo:
- Identifica el nombre con el que el cliente se ha presentado (por ejemplo "me llamo Marta", "soy Luis", "mi nombre es Ana").
- Si el cliente dio nombre y apellidos, devuelve ambos. Si solo dio un nombre, devuelve ese nombre.

Reglas:
- RESPONDE ÚNICAMENTE con el nombre detectado, sin texto adicional, sin comillas y sin emojis.
- Si hay varias personas mencionadas, elige el nombre del cliente que está hablando con el bot.
- Si no hay nombre claro, responde exactamente "UNKNOWN".
`.trim();

export async function extractClientName(history: HistoryItem[]): Promise<string | null> {
  const hasUserContent = history.some((item) => item.role === "user" && item.text.trim());
  if (!hasUserContent) {
    return null;
  }

  const inputText = buildInputText(history);
  const response = await getClient().responses.create({
    model: resolveModel(),
    instructions: NAME_EXTRACTION_INSTRUCTIONS,
    input: inputText,
    store: false,
    text: { format: { type: "text" } },
  });

  const output = response.output_text?.trim();
  if (!output || output.toUpperCase() === "UNKNOWN") {
    return null;
  }

  return output.replace(/["']/g, "").trim();
}

export async function translateTextToBritishEnglish(text: string): Promise<string> {
  if (!text.trim()) {
    return text;
  }

  const model = resolveModel();
  const response = await getClient().responses.create({
    model,
    instructions:
      "Translate the provided property description into natural British English. Preserve numbers, measurements, and formatting. Respond with the translation only.",
    input: text,
    store: false,
    text: { format: { type: "text" } },
  });

  const output = response.output_text;
  if (!output) {
    throw new Error("OpenAI translation response did not include output_text");
  }

  return output.trim();
}

type ListingCandidateForLlm = {
  listingCode: string;
  description?: string;
  address?: string;
  price?: string | number;
  link?: string;
};

export type ListingResolutionDecision =
  | { kind: "match"; listingCode: string }
  | { kind: "ambiguous"; listingCodes: string[] }
  | { kind: "none" };

export async function decideListingFromCandidates(params: {
  userText: string;
  candidates: ListingCandidateForLlm[];
  operationType?: string;
}): Promise<ListingResolutionDecision> {
  const model = resolveModel();

  const instructions = `
Eres un clasificador que debe elegir cuál anuncio (si alguno) coincide con el mensaje del cliente.

Responde EXCLUSIVAMENTE con UNA de estas formas (sin texto extra):
- match:<listingCode>
- ambiguous:<listingCode1>,<listingCode2>,...   (2 a 5 códigos, solo los plausibles)
- none

Reglas:
- Si el usuario pegó un enlace o referencia que claramente corresponde a un candidato, elige match.
- Si hay duda real entre varios, usa ambiguous con los mejores.
- Si no hay suficiente información, responde none.
  `.trim();

  const input = [
    `Tipo de operación: ${params.operationType || "desconocido"}`,
    "",
    "Texto del cliente:",
    params.userText.trim().slice(0, 2000),
    "",
    "Candidatos (JSON):",
    JSON.stringify(params.candidates.slice(0, 30)),
  ].join("\n");

  const response = await getClient().responses.create({
    model,
    instructions,
    input,
    store: false,
    text: { format: { type: "text" } },
  });

  const raw = (response.output_text || "").trim();
  if (!raw) return { kind: "none" };

  const m = raw.match(/^(match|ambiguous|none)\s*:?\\s*(.*)$/i);
  if (!m) return { kind: "none" };
  const kind = m[1].toLowerCase();
  const rest = (m[2] || "").trim();

  if (kind === "none") return { kind: "none" };
  if (kind === "match") {
    const code = rest.split(/[\\s,]+/).find(Boolean);
    return code ? { kind: "match", listingCode: code } : { kind: "none" };
  }
  const codes = rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  return codes.length >= 2 ? { kind: "ambiguous", listingCodes: codes } : { kind: "none" };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseConfidence(raw: string | undefined, fallback = 0.5): number {
  if (!raw) return fallback;
  const normalized = raw.replace(",", ".").trim();
  const parsed = Number(normalized);
  return clampConfidence(Number.isFinite(parsed) ? parsed : fallback);
}

function parseRankedCandidatesSegment(raw: string | undefined, validListingCodes: Set<string>): AgentListingCandidate[] {
  if (!raw) return [];
  const entries = raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 40);
  const candidates: AgentListingCandidate[] = [];
  const seenCodes = new Set<string>();
  for (const entry of entries) {
    const [rawCode, rawConfidence, ...reasonParts] = entry.split("|").map((part) => part.trim());
    if (!rawCode || !validListingCodes.has(rawCode) || seenCodes.has(rawCode)) continue;
    const confidence = parseConfidence(rawConfidence, 0.5);
    const reason = reasonParts.join("|").trim() || undefined;
    candidates.push({ listingCode: rawCode, confidence, reason });
    seenCodes.add(rawCode);
  }
  return candidates
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 25);
}

export function parseAgentListingResolution(
  rawOutput: string,
  validListingCodes: Set<string>
): AgentListingResolutionDecision {
  const fallback: AgentListingResolutionDecision = {
    kind: "none",
    confidence: 0,
    reason: "No parseable decision from model output.",
    candidates: [],
  };
  const raw = (rawOutput || "").trim();
  if (!raw) return fallback;

  const firstLine = raw.split(/\n+/)[0].trim();
  const segments = firstLine.split(":");
  if (segments.length === 0) return fallback;
  const kind = (segments[0] || "").trim().toLowerCase();

  if (kind === "match") {
    const listingCode = (segments[1] || "").trim();
    if (!listingCode || !validListingCodes.has(listingCode)) return fallback;
    const confidence = parseConfidence(segments[2], 0.8);
    const reason = segments.slice(3).join(":").trim() || "Matched by strongest combined evidence.";
    const rankedCandidates = parseRankedCandidatesSegment(segments[4], validListingCodes);
    const candidates = rankedCandidates.length > 0
      ? rankedCandidates
      : [{ listingCode, confidence, reason }];
    return { kind: "match", listingCode, confidence, reason, candidates };
  }

  if (kind === "ambiguous") {
    const rankedCandidates = parseRankedCandidatesSegment(segments[1], validListingCodes);
    if (rankedCandidates.length < 2) return fallback;
    const confidence = parseConfidence(segments[2], 0.55);
    const reason = segments.slice(3).join(":").trim() || "Several listings fit similarly.";
    return { kind: "ambiguous", confidence, reason, candidates: rankedCandidates };
  }

  if (kind === "none") {
    const confidence = parseConfidence(segments[1], 0.4);
    const reason = segments.slice(2).join(":").trim() || "Insufficient evidence to match safely.";
    return { kind: "none", confidence, reason, candidates: [] };
  }

  return fallback;
}

export async function resolveListingWithAgent(params: {
  bufferText: string;
  activeListings: ListingForResolution[];
  operationType?: OperationType;
}): Promise<AgentListingResolutionDecision> {
  if (!params.activeListings || params.activeListings.length === 0) {
    return {
      kind: "none",
      confidence: 0,
      reason: "No active listings available.",
      candidates: [],
    };
  }

  const listingsPayload = params.activeListings.slice(0, 700).map((listing) => ({
    listingCode: listing.listingCode,
    operationType: listing.operationType || "",
    price: listing.price ?? "",
    address: listing.address || listing.street || "",
    street: listing.street || "",
    city: listing.city || "",
    province: listing.province || "",
    description: (listing.description || "").slice(0, 160),
    link: listing.link || "",
  }));
  const validListingCodes = new Set(listingsPayload.map((l) => l.listingCode).filter(Boolean));

  const instructions = `
Eres un agente de matching inmobiliario. Tu tarea es identificar qué anuncio del catálogo activo corresponde al mensaje del cliente.

Debes responder EXCLUSIVAMENTE en UNA línea con este formato:
- match:<listingCode>:<confidence_0_1>:<reason_short>:<ranked_candidates>
- ambiguous:<ranked_candidates>:<confidence_0_1>:<reason_short>
- none:<confidence_0_1>:<reason_short>

Formato de ranked_candidates:
- code|confidence|reason,code|confidence|reason,...
- Máximo 25 candidatos ordenados de mayor a menor confianza.
- confidence siempre entre 0 y 1.

Reglas obligatorias:
1) Prioriza coincidencias explícitas de referencia o enlace.
2) Interpreta precios de forma flexible y humana:
   - ejemplos: "2200", "2200€/mes", "2.2k", "400mil", "0.4M".
3) En venta/alquiler permite aproximación razonable de precio (no exactitud rígida), pero evita falsos positivos.
4) Usa también dirección parcial, zona, ciudad y variantes ortográficas.
5) Si hay duda real entre varios anuncios, devuelve ambiguous con 2-25 códigos.
6) Si no hay evidencia suficiente, devuelve none.
7) No inventes códigos; usa solo códigos del catálogo proporcionado.
8) En match, incluye ranked_candidates con al menos el código elegido en primera posición.
9) En ambiguous, ranked_candidates debe contener 2-25 opciones.
  `.trim();

  const input = [
    `Tipo de operación detectado: ${params.operationType || "desconocido"}`,
    "",
    "Texto combinado del cliente:",
    (params.bufferText || "").trim().slice(0, 4000),
    "",
    "Catálogo activo (JSON):",
    JSON.stringify(listingsPayload),
  ].join("\n");

  const response = await getClient().responses.create({
    model: resolveModel(),
    instructions,
    input,
    store: false,
    text: { format: { type: "text" } },
  });

  return parseAgentListingResolution(response.output_text || "", validListingCodes);
}

export type LeadFilterResult = { pass: boolean; reason: string };

export async function checkLeadPassesFilters(params: {
  conversationSummary: string;
  operationType: OperationType;
  minMonthlyIncome?: number;
  maxPeople?: number;
  requireMortgageApproved?: boolean;
}): Promise<LeadFilterResult> {
  const filterLines: string[] = [];

  if (params.operationType === "Alquiler") {
    if (params.minMonthlyIncome != null) {
      filterLines.push(`- Ingresos netos mensuales mínimos exigidos: ${params.minMonthlyIncome} €/mes`);
    }
    if (params.maxPeople != null) {
      filterLines.push(`- Número máximo de personas permitidas: ${params.maxPeople}`);
    }
  } else {
    if (params.requireMortgageApproved) {
      filterLines.push(`- Solo se acepta compra al contado o con hipoteca ya concedida por el banco. Se descarta cualquier lead que necesite tramitar la hipoteca o no lo haya mencionado.`);
    }
  }

  if (filterLines.length === 0) {
    return { pass: true, reason: "No hay filtros activos." };
  }

  const instructions = `
Eres un agente de filtrado de leads inmobiliarios. Tu misión es determinar si el lead cumple los criterios de filtrado del anuncio.

Criterios de filtrado activos:
${filterLines.join("\n")}

Reglas:
- Analiza el resumen de conversación y decide si el lead cumple TODOS los criterios.
- Si un criterio relevante no se menciona en el resumen, considera que NO se cumple (actitud conservadora).
- Responde EXCLUSIVAMENTE con JSON válido, sin texto adicional: {"pass": true, "reason": "..."} o {"pass": false, "reason": "..."}
- La razón debe ser breve (máximo 1 frase en español) y explicar el motivo del resultado.
`.trim();

  const response = await getClient().responses.create({
    model: "gpt-4o-mini",
    instructions,
    input: `Resumen de conversación con el lead:\n${params.conversationSummary}`,
    store: false,
    text: { format: { type: "text" } },
  });

  const output = (response.output_text || "").trim();
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  const jsonCandidate = start !== -1 && end !== -1 && end > start ? output.slice(start, end + 1) : output;

  try {
    const parsed = JSON.parse(jsonCandidate);
    const pass = parsed.pass === true;
    const reason = typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : pass ? "Lead cumple los criterios." : "Lead no cumple los criterios.";
    return { pass, reason };
  } catch {
    console.warn("checkLeadPassesFilters: failed to parse AI response", jsonCandidate);
    // Fail-open: if we can't parse the response, let the lead through to avoid false rejections
    return { pass: true, reason: "No se pudo evaluar el filtro; lead aprobado por defecto." };
  }
}

export type ConfirmDenyDecision = "confirm" | "deny" | "unclear";

export async function classifyConfirmDeny(params: {
  userText: string;
  promptContext?: string;
}): Promise<ConfirmDenyDecision> {
  const model = resolveModel();
  const instructions = `
Clasifica la intención del usuario respecto a una confirmación de “¿Es este el anuncio?”.

Responde EXCLUSIVAMENTE con una palabra:
- confirm
- deny
- unclear

Guía:
- confirm: el usuario confirma que sí es, o muestra acuerdo claro para continuar con ese anuncio.
- deny: el usuario dice que no es, que es otro, o rechaza explícitamente.
- unclear: no queda claro, o contesta otra cosa.
  `.trim();

  const input = [
    params.promptContext ? `Contexto:\n${params.promptContext}` : "",
    "Mensaje del usuario:",
    params.userText.trim().slice(0, 1000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await getClient().responses.create({
    model,
    instructions,
    input,
    store: false,
    text: { format: { type: "text" } },
  });

  const raw = (response.output_text || "").trim().toLowerCase();
  if (raw === "confirm" || raw === "deny" || raw === "unclear") return raw;
  return "unclear";
}

