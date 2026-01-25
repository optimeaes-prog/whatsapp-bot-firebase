import * as admin from "firebase-admin";
import { AnuncioRow, BotConfig, BotStyle, ConversationState, HistoryItem, TipoOperacion } from "../types";

// Initialize Firestore with specific database once
let firestoreInstance: FirebaseFirestore.Firestore | null = null;

const getDb = () => {
  if (!firestoreInstance) {
    firestoreInstance = admin.firestore();
    firestoreInstance.settings({ databaseId: "realestate-whatsapp-bot" });
  }
  return firestoreInstance;
};

// Anuncios
export async function fetchAnuncioById(anuncioId: string): Promise<AnuncioRow | null> {
  const snapshot = await getDb().collection("anuncios").where("anuncio", "==", anuncioId).get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    descripcion: data.descripcion || "",
    anuncio: data.anuncio || "",
    enlace: data.enlace || "",
    tipoOperacion: data.tipoOperacion as TipoOperacion,
    caracteristicas: data.caracteristicas || "",
    informeRentabilidadDisponible: data.informeRentabilidadDisponible || false,
    informeRentabilidad: data.informeRentabilidad || "",
  };
}

// Leads
export async function findLeadByChatId(chatId: string): Promise<{
  telefono: string;
  anuncio: string;
  chatId: string;
  tipoOperacion: TipoOperacion;
} | null> {
  const snapshot = await getDb().collection("leads").where("chatId", "==", chatId).get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    telefono: data.telefono || "",
    anuncio: data.anuncio || "",
    chatId: data.chatId || "",
    tipoOperacion: data.tipoOperacion as TipoOperacion,
  };
}

export async function createLead(data: {
  telefono: string;
  anuncio: string;
  chatId: string;
  tipoOperacion: TipoOperacion;
}): Promise<void> {
  await getDb().collection("leads").add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function updateLeadChatInfo(params: {
  telefono: string;
  anuncio: string;
  chatId: string;
  tipoOperacion: TipoOperacion;
}): Promise<void> {
  const snapshot = await getDb()
    .collection("leads")
    .where("telefono", "==", params.telefono)
    .where("anuncio", "==", params.anuncio)
    .get();

  if (snapshot.empty) {
    // Create new lead if not found
    await createLead(params);
    return;
  }

  const docRef = snapshot.docs[0].ref;
  await docRef.update({
    chatId: params.chatId,
    tipoOperacion: params.tipoOperacion,
  });
}

// Conversaciones
export async function getConversacionByChatId(chatId: string): Promise<ConversationState | null> {
  const docRef = getDb().collection("conversaciones").doc(chatId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as ConversationState;
}

export async function upsertConversacion(chatId: string, data: Partial<ConversationState>): Promise<void> {
  const docRef = getDb().collection("conversaciones").doc(chatId);
  await docRef.set(
    {
      ...data,
      chatId,
      numeroMensajes: data.history?.length || 0,
      ultimoMensaje: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function appendConversationRow(params: {
  telefono: string;
  chatId: string;
  anuncio: string;
  history: HistoryItem[];
  nombre?: string;
  cualificado?: boolean;
  isFinished?: boolean;
}): Promise<void> {
  await upsertConversacion(params.chatId, {
    telefono: params.telefono,
    anuncio: params.anuncio,
    history: params.history,
    nombre: params.nombre,
    qualificationStatus: params.cualificado,
    isFinished: params.isFinished,
  } as Partial<ConversationState>);
}

// Cualificados
export async function appendCualificadoRow(params: {
  telefono: string;
  chatId: string;
  anuncio: string;
  resumenConversacion: string;
  nombre: string;
  cualificado: boolean;
}): Promise<void> {
  await getDb().collection("cualificados").add({
    ...params,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Bot Config
const DEFAULT_STYLES: BotStyle[] = [
  {
    id: "directo",
    name: "Directo y Eficiente",
    description: "Mensajes cortos, sin relleno, agrupa preguntas.",
    promptModifier: `- Mensajes CORTOS y DIRECTOS. Máximo 2-3 líneas por mensaje.
- NO repitas información que el usuario acaba de dar.
- NO hagas resúmenes innecesarios ("Entonces, para resumir...").
- NO uses frases de relleno ("¡Gracias por la información!", "Todo parece encajar bien", "Entendido").
- AGRUPA las preguntas relacionadas en UN SOLO mensaje.
- Si el usuario da varios datos, reconócelos brevemente y pregunta SOLO lo que falta.
- Sé amable pero valora el tiempo del usuario.
- VARÍA tu vocabulario: no repitas "Perfecto" constantemente. Usa alternativas como "Genial", "Estupendo", "Vale", "De acuerdo", etc.`,
  },
  {
    id: "amigable",
    name: "Amigable y Cercano",
    description: "Tono cálido con emojis, más personalizado.",
    promptModifier: `- Usa un tono CÁLIDO y CERCANO, como si hablaras con un amigo.
- Incluye emojis ocasionales para dar calidez (😊, 👍, 🏠, ✨) pero sin exceso.
- Haz preguntas de una en una para que la conversación fluya naturalmente.
- Muestra entusiasmo genuino por ayudar al cliente a encontrar su hogar ideal.
- Usa expresiones cercanas como "¡Qué bien!", "Me encanta", "¡Genial!".
- Personaliza las respuestas usando el nombre del cliente cuando lo sepas.
- Sé empático si el cliente expresa dudas o preocupaciones.`,
  },
  {
    id: "formal",
    name: "Formal y Profesional",
    description: "Tratamiento de usted, lenguaje corporativo.",
    promptModifier: `- Usa tratamiento de USTED en todo momento.
- Mantén un tono PROFESIONAL y CORPORATIVO.
- Evita coloquialismos y expresiones informales.
- Usa frases como "Le informo que...", "Permítame indicarle...", "Tendría usted disponibilidad para...".
- Sé cortés pero manteniendo distancia profesional.
- No uses emojis ni expresiones demasiado efusivas.
- Estructura las respuestas de forma clara y ordenada.
- Agradece formalmente: "Le agradezco su interés", "Gracias por su tiempo".`,
  },
  {
    id: "conciso",
    name: "Ultra Conciso",
    description: "Mínimo de palabras, solo lo esencial.",
    promptModifier: `- MÁXIMA brevedad. Una línea por mensaje si es posible.
- Solo lo ESENCIAL. Nada de cortesías innecesarias.
- Preguntas directas sin introducción.
- Respuestas tipo telegrama.
- Sin emojis, sin relleno, sin repeticiones.
- Ejemplo: "¿Nombre?" en vez de "¿Con quién tengo el gusto de hablar?"
- Ejemplo: "¿Hipoteca o contado?" en vez de "¿La compra sería al contado o necesitaría financiación mediante hipoteca?"`,
  },
];

export async function getBotConfig(): Promise<BotConfig> {
  const docRef = getDb().collection("botConfig").doc("config");
  const doc = await docRef.get();

  if (!doc.exists) {
    const defaultConfig: BotConfig = {
      activeStyleId: "directo",
      styles: DEFAULT_STYLES,
    };
    await docRef.set(defaultConfig);
    return defaultConfig;
  }

  return doc.data() as BotConfig;
}

export async function getActiveStyle(): Promise<BotStyle> {
  const config = await getBotConfig();
  const activeStyle = config.styles.find((s) => s.id === config.activeStyleId);
  return activeStyle || DEFAULT_STYLES[0];
}
