import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { ListingRow, BotConfig, BotStyle, ConversationState, QualificationStatus, HistoryItem, OperationType } from "../types";

// Initialize Firestore with specific database once
let firestoreInstance: FirebaseFirestore.Firestore | null = null;

const DATABASE_ID = "realestate-whatsapp-bot";

const getDb = () => {
  if (!firestoreInstance) {
    // Use the modular API to get a named database
    firestoreInstance = getFirestore(admin.app(), DATABASE_ID);
    // Configure Firestore to ignore undefined properties
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreInstance;
};

// Listings
export async function fetchListingByCode(listingCode: string): Promise<ListingRow | null> {
  const snapshot = await getDb().collection("listings").where("listingCode", "==", listingCode).get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    description: data.description || "",
    listingCode: data.listingCode || "",
    link: data.link || "",
    operationType: data.operationType as OperationType,
    features: data.features || "",
    profitabilityReportAvailable: data.profitabilityReportAvailable || false,
    profitabilityReport: data.profitabilityReport || "",
  };
}

// Leads
export async function findLeadByChatId(chatId: string): Promise<{
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  firstMessageDate?: FirebaseFirestore.Timestamp;
  lastMessageDate?: FirebaseFirestore.Timestamp;
  qualificationStatus?: QualificationStatus;
} | null> {
  const snapshot = await getDb().collection("leads").where("chatId", "==", chatId).get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    phone: data.phone || "",
    listingCode: data.listingCode || "",
    chatId: data.chatId || "",
    operationType: data.operationType as OperationType,
    name: data.name,
    firstMessageDate: data.firstMessageDate,
    lastMessageDate: data.lastMessageDate,
    qualificationStatus: data.qualificationStatus as QualificationStatus | undefined,
  };
}

export async function createLead(data: {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  qualificationStatus?: QualificationStatus;
}): Promise<void> {
  await getDb().collection("leads").add({
    phone: data.phone,
    listingCode: data.listingCode,
    chatId: data.chatId,
    operationType: data.operationType,
    name: data.name,
    qualificationStatus: data.qualificationStatus,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    firstMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function updateLeadChatInfo(params: {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  qualificationStatus?: QualificationStatus;
}): Promise<void> {
  const snapshot = await getDb()
    .collection("leads")
    .where("phone", "==", params.phone)
    .where("listingCode", "==", params.listingCode)
    .get();

  if (snapshot.empty) {
    // Create new lead if not found
    await createLead(params);
    return;
  }

  const docRef = snapshot.docs[0].ref;
  const updateData: Record<string, unknown> = {
    chatId: params.chatId,
    operationType: params.operationType,
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (params.name !== undefined) {
    updateData.name = params.name;
  }

  if (params.qualificationStatus !== undefined) {
    updateData.qualificationStatus = params.qualificationStatus;
  }

  await docRef.update(updateData);
}

// Conversations
export async function getConversationByChatId(chatId: string): Promise<ConversationState | null> {
  const docRef = getDb().collection("conversations").doc(chatId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as ConversationState;
}

export async function getConversationByPhoneAndListing(phone: string, listingCode: string): Promise<ConversationState | null> {
  // Use leads collection to find the chatId because it has a composite index on [phone, listingCode]
  const snapshot = await getDb()
    .collection("leads")
    .where("phone", "==", phone)
    .where("listingCode", "==", listingCode)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const leadData = snapshot.docs[0].data();
  const chatId = leadData.chatId;

  if (!chatId) {
    return null;
  }

  return getConversationByChatId(chatId);
}

export async function upsertConversation(chatId: string, data: Partial<ConversationState>): Promise<void> {
  const docRef = getDb().collection("conversations").doc(chatId);
  await docRef.set(
    {
      ...data,
      chatId,
      messageCount: data.history?.length || 0,
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function appendConversationRow(params: {
  phone: string;
  chatId: string;
  listingCode: string;
  history: HistoryItem[];
  name?: string;
  qualified?: boolean | null;
  isFinished?: boolean;
}): Promise<void> {
  await upsertConversation(params.chatId, {
    phone: params.phone,
    listingCode: params.listingCode,
    history: params.history,
    name: params.name,
    qualificationStatus: params.qualified ?? null,
    isFinished: params.isFinished,
  } as Partial<ConversationState>);
}

// Qualified Leads
export async function appendQualifiedLeadRow(params: {
  phone: string;
  chatId: string;
  listingCode: string;
  conversationSummary: string;
  name: string;
  qualified: boolean;
}): Promise<void> {
  await getDb().collection("qualifiedLeads").add({
    phone: params.phone,
    chatId: params.chatId,
    listingCode: params.listingCode,
    conversationSummary: params.conversationSummary,
    name: params.name,
    qualified: params.qualified,
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

// Update lead status when qualified or rejected
export async function updateLeadStatus(params: {
  chatId: string;
  name?: string;
  qualificationStatus: QualificationStatus;
}): Promise<void> {
  const snapshot = await getDb()
    .collection("leads")
    .where("chatId", "==", params.chatId)
    .get();

  if (snapshot.empty) {
    console.warn(`No lead found with chatId ${params.chatId}`);
    return;
  }

  const docRef = snapshot.docs[0].ref;
  const updateData: Record<string, unknown> = {
    qualificationStatus: params.qualificationStatus,
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (params.name !== undefined) {
    updateData.name = params.name;
  }

  await docRef.update(updateData);
}

// ==================== MESSAGE BUFFER FUNCTIONS ====================

/**
 * Add a pending message to the conversation buffer
 */
export async function addPendingMessage(
  chatId: string,
  message: { text: string; timestamp: number }
): Promise<void> {
  const docRef = getDb().collection("conversations").doc(chatId);

  await docRef.set(
    {
      pendingUserMessages: admin.firestore.FieldValue.arrayUnion({
        text: message.text,
        timestamp: message.timestamp,
      }),
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Update buffer task info for a conversation
 */
export async function updateBufferTask(
  chatId: string,
  taskName: string,
  bufferExpiresAt: number
): Promise<void> {
  const docRef = getDb().collection("conversations").doc(chatId);

  await docRef.set(
    {
      pendingTaskName: taskName,
      bufferExpiresAt,
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Get pending messages and clear them atomically
 */
export async function getPendingMessagesAndClear(
  chatId: string
): Promise<{ text: string; timestamp: number }[]> {
  const docRef = getDb().collection("conversations").doc(chatId);

  return await getDb().runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);

    if (!doc.exists) {
      return [];
    }

    const data = doc.data();
    const pendingMessages = (data?.pendingUserMessages || []) as { text: string; timestamp: number }[];

    // Clear pending messages and task info
    transaction.update(docRef, {
      pendingUserMessages: [],
      pendingTaskName: admin.firestore.FieldValue.delete(),
      bufferExpiresAt: admin.firestore.FieldValue.delete(),
    });

    return pendingMessages;
  });
}

/**
 * Check if conversation has pending messages
 */
export async function hasPendingMessages(chatId: string): Promise<boolean> {
  const docRef = getDb().collection("conversations").doc(chatId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return false;
  }

  const data = doc.data();
  const pendingMessages = data?.pendingUserMessages || [];
  return Array.isArray(pendingMessages) && pendingMessages.length > 0;
}

/**
 * Get conversations that are idle for more than a certain number of hours
 */
export async function getConversationsForFollowUp(maxAgeHours: number): Promise<ConversationState[]> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - maxAgeHours);

  const snapshot = await getDb()
    .collection("conversations")
    .where("isFinished", "==", false)
    .where("lastMessage", "<=", cutoff)
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs
    .map(doc => doc.data() as ConversationState)
    .filter(conv => {
      // Only follow up if:
      // 1. Follow up hasn't been sent yet
      // 2. The user has NEVER responded (no user messages in history)
      // 3. There are no pending messages waiting in the buffer
      const hasUserResponded = conv.history?.some(h => h.role === "user");
      const hasPendingMessages = conv.pendingUserMessages && conv.pendingUserMessages.length > 0;

      return !conv.followUpSent && !hasUserResponded && !hasPendingMessages;
    });
}
