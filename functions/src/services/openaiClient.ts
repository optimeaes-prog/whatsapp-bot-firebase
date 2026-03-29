import OpenAI from "openai";
import { defineString } from "firebase-functions/params";
import { ConversationState, HistoryItem, LeadSummary, BotStyle } from "../types";

const OPENAI_API_KEY = defineString("OPENAI_API_KEY");
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

function buildBasePrompt(styleModifier: string, language: "es" | "en" = "es"): string {
  if (language === "en") {
    return `
You are a virtual assistant for a Real Estate Agent. You qualify leads DIRECTLY and EFFICIENTLY.

========================
COMMUNICATION STYLE (VERY IMPORTANT)
========================
${styleModifier}
- ALWAYS respond in the exact same language the user uses in their messages. If they write in English, use natural British English. If they write in another language, adapt to it. Use a professional yet friendly tone.

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
- If the user hasn't introduced themselves, ask: "Who am I speaking with?"
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
- BEFORE CLOSING: If you haven't captured the user's name yet, ask for it ONE LAST TIME instead of closing the conversation.
- When you have the information (including availability, and you have asked for their name) → natural closing message indicating the agent WILL CALL to CONFIRM the visit + marker.
- NEVER give the impression that the visit is already confirmed or scheduled.

========================
FLOW FOR "Rental"
========================
Objective: Get the tenant profile.

STEP 1 - NAME:
- If the user hasn't introduced themselves, ask: "Who am I speaking with?"
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
- BEFORE CLOSING: If you haven't captured the user's name yet, ask for it ONE LAST TIME instead of closing the conversation.
- When you have: people, income, dates, pets, availability (and you have asked for their name) → natural closing message indicating the agent WILL CALL to CONFIRM the visit + marker.
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
${styleModifier}
- RESPONDE SIEMPRE en el mismo idioma en el que te escriba el usuario. Si te habla en español, usa tuteo respetuoso. Si te habla en inglés, inglés británico, etc. Es una regla estricta adaptarte a su idioma.

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
- Si el usuario no se ha presentado, pregúntalo: "¿Con quién hablo?"
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
- ANTES DE CERRAR: Si aún no has capturado el nombre del usuario, pídeselo UNA ÚLTIMA VEZ en lugar de cerrar la conversación.
- Cuando tengas la información (incluida disponibilidad, y hayas pedido el nombre) → mensaje de cierre natural indicando que el comercial LLAMARÁ para CONFIRMAR la visita + marcador.
- NUNCA des la impresión de que la visita ya está confirmada o agendada.

========================
FLUJO PARA "Alquiler"
========================
Objetivo: Obtener perfil del inquilino.

PASO 1 - NOMBRE:
- Si el usuario no se ha presentado, pregúntalo: "¿Con quién hablo?"
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
- ANTES DE CERRAR: Si aún no has capturado el nombre del usuario, pídeselo UNA ÚLTIMA VEZ en lugar de cerrar la conversación.
- Cuando tengas: personas, ingresos, fechas, mascotas y disponibilidad (y hayas pedido el nombre) → mensaje de cierre natural indicando que el comercial LLAMARÁ para CONFIRMAR la visita + marcador.
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
  const language = state.language || "es";
  const basePrompt = buildBasePrompt(style.promptModifier, language);

  let operationTypeLabel: string = state.operationType || "Venta";
  if (language === "en") {
    operationTypeLabel = state.operationType === "Alquiler" ? "Rental" : "Sale";
  }

  const template = basePrompt.replace(/\{\{TIPO_OPERACION\}\}/g, operationTypeLabel);
  const parts: string[] = [
    template,
    "========================",
    language === "en" ? "SPECIFIC DATA FOR THIS CONVERSATION" : "DATOS ESPECÍFICOS DE ESTA CONVERSACIÓN",
    "========================",
    language === "en" ? `Listing link: ${state.link}` : `Enlace del anuncio: ${state.link}`,
    language === "en" ? `Address: ${state.address || "Not specified"}` : `Dirección: ${state.address || "No especificada"}`,
    language === "en" ? `Communicated features: ${state.features}` : `Características comunicadas: ${state.features}`,
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

