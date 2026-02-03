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
  return OPENAI_MODEL.value() || "gpt-4o";
}

function buildBasePrompt(styleModifier: string): string {
  return `
Eres un asistente virtual de un Agente Inmobiliario. Cualificas leads de forma DIRECTA y EFICIENTE.

========================
ESTILO DE COMUNICACIÓN (MUY IMPORTANTE)
========================
${styleModifier}
- Si la conversación es en inglés, responde en inglés británico. Si es en español, usa tuteo respetuoso.

Herramientas y Alcance:
- No uses herramientas externas.
- Tu conocimiento se limita a: enlace del anuncio + características proporcionadas.
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
- Cuando tengas la información (incluida disponibilidad) → mensaje de cierre natural indicando que el comercial LLAMARÁ para CONFIRMAR la visita + marcador.
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
  const basePrompt = buildBasePrompt(style.promptModifier);
  const template = basePrompt.replace(/\{\{TIPO_OPERACION\}\}/g, state.operationType);
  const parts: string[] = [
    template,
    "========================",
    "DATOS ESPECÍFICOS DE ESTA CONVERSACIÓN",
    "========================",
    `Enlace del anuncio: ${state.link}`,
    `Características comunicadas: ${state.features}`,
    `Informe de rentabilidad disponible: ${state.profitabilityReportAvailable ? "TRUE" : "FALSE"}`,
  ];

  if (state.profitabilityReportAvailable && state.profitabilityReport) {
    parts.push("Texto Informe Rentabilidad:", state.profitabilityReport);
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

Debes responder EXCLUSIVAMENTE con un JSON válido (sin texto extra ni comentarios) con exactamente estas claves string:
{
  "name": "",
  "people": "",
  "income": "",
  "pets": "",
  "paymentMethod": "",
  "dates": "",
  "visitAvailability": "",
  "notes": ""
}

Reglas:
- Escribe todos los valores en español y en estilo breve.
- Si un dato no se mencionó, deja la cadena vacía "".
- "people" debe describir cuántas vivirán o su composición familiar.
- "income" debe indicar ingresos netos/forma de sustento.
- "pets" indica sí/no y tipo.
- "paymentMethod" describe cómo pagará (hipoteca, contado, etc.).
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
    `Tipo de operación actual: ${state.operationType}. ${focusText}`,
    'Si el lead confirmó que no tiene una mascota, escribe "Sin mascotas" en lugar de dejarlo vacío.',
  ].join("\n");
}

function parseLeadSummaryValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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
      income: parseLeadSummaryValue(parsed.income),
      pets: parseLeadSummaryValue(parsed.pets),
      paymentMethod: parseLeadSummaryValue(parsed.paymentMethod),
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
