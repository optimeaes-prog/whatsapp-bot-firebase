import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { ListingRow, ListingForResolution, BotConfig, BotStyle, ConversationState, QualificationStatus, HistoryItem, OperationType } from "../types";
import { getChatIdVariants, normalizeToCanonicalChatId } from "../utils";
import { normalizeForSearch } from "../utils/addressNormalize";


// Initialize Firestore with specific database once
let firestoreInstance: FirebaseFirestore.Firestore | null = null;

const DATABASE_ID = "realestate-whatsapp-bot";

const getDb = () => {
  if (!firestoreInstance) {
    // Use the modular API to get a named database
    firestoreInstance = getFirestore(admin.app(), DATABASE_ID);
  }
  return firestoreInstance;
};

import { getActiveOrgId } from "./requestContext";

const getOrgDb = () => {
  return getDb().collection("organizations").doc(getActiveOrgId());
};

function buildLeadDocId(phone: string, listingCode: string): string {
  // Firestore document IDs cannot contain "/" and should be stable for idempotent upserts.
  const safePhone = String(phone || "").trim().replace(/[^\d+]/g, "");
  const safeListing = String(listingCode || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `lead_${safePhone}_${safeListing}`;
}

function listingRowFromDoc(data: FirebaseFirestore.DocumentData): ListingRow {
  return {
    description: data.description || "",
    listingCode: data.listingCode || "",
    listingCodeFotocasa: data.listingCodeFotocasa || "",
    link: data.link || "",
    operationType: data.operationType as OperationType,
    features: data.features || "",
    profitabilityReportAvailable: data.profitabilityReportAvailable || false,
    profitabilityReport: data.profitabilityReport || "",
    price: data.price,
    m2: data.m2,
    rooms: data.rooms,
    address: data.address,
    street: data.street,
    city: data.city,
    province: data.province,
    postalCode: data.postalCode,
    country: data.country,
    provinceNormalized: data.provinceNormalized,
    idealistaDescription: data.idealistaDescription,
    quickQualificationEnabled: data.quickQualificationEnabled === true,
    agentName: data.agentName,
    minMonthlyIncome: typeof data.minMonthlyIncome === "number" ? data.minMonthlyIncome : undefined,
    maxPeople: typeof data.maxPeople === "number" ? data.maxPeople : undefined,
    requireMortgageApproved: data.requireMortgageApproved === true,
  };
}

// Listings
export async function fetchListingByCode(listingCode: string): Promise<ListingRow | null> {
  const snapshot = await getOrgDb().collection("listings")
    .where("listingCode", "==", listingCode)
    .where("isActive", "==", true)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return listingRowFromDoc(doc.data());
}

/**
 * Find a listing by code across all organizations.
 * Useful for public webhooks that don't specify an org context.
 */
export async function fetchListingGlobally(listingCode: string): Promise<{ data: ListingRow, orgId: string } | null> {
  const snapshot = await getDb().collectionGroup("listings")
    .where("listingCode", "==", listingCode)
    .where("isActive", "==", true)
    .get();
    
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  const orgId = doc.ref.path.split("/")[1];
  
  return { 
    data: listingRowFromDoc(doc.data()), 
    orgId 
  };
}

export async function listActiveListingsForResolution(params?: {
  operationType?: OperationType;
  limit?: number;
}): Promise<ListingForResolution[]> {
  let query: admin.firestore.Query = getOrgDb().collection("listings").where("isActive", "==", true);
  if (params?.operationType) {
    query = query.where("operationType", "==", params.operationType);
  }
  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      listingCode: data.listingCode || "",
      operationType: data.operationType as OperationType | undefined,
      description: data.description || "",
      address: data.address || "",
      street: data.street || "",
      city: data.city || "",
      province: data.province || "",
      price: data.price,
      link: data.link || "",
    } as ListingForResolution;
  }).filter((row) => !!row.listingCode);
  const limit = typeof params?.limit === "number" && params.limit > 0 ? params.limit : rows.length;
  return rows.slice(0, limit);
}

export async function searchListings(filters: {
  operationType?: OperationType;
  province?: string;
  street?: string;
  price?: number;
  rooms?: number;
  m2?: number;
  candidateListingCodes?: string[];
}): Promise<ListingRow[]> {
  let query: admin.firestore.Query = getOrgDb().collection("listings")
    .where("isActive", "==", true);

  if (filters.operationType) {
    query = query.where("operationType", "==", filters.operationType);
  }

  const snapshot = await query.get();
  let results = snapshot.docs.map((doc) => listingRowFromDoc(doc.data()));

  if (filters.candidateListingCodes && filters.candidateListingCodes.length > 0) {
    const allowed = new Set(filters.candidateListingCodes.map((c) => String(c).trim()).filter(Boolean));
    results = results.filter((r) => allowed.has(r.listingCode));
  }

  if (filters.province) {
    const want = normalizeForSearch(filters.province);
    results = results.filter((r) => {
      const stored =
        (typeof r.provinceNormalized === "string" && r.provinceNormalized
          ? normalizeForSearch(r.provinceNormalized)
          : "") ||
        (r.province ? normalizeForSearch(r.province) : "");
      if (stored) {
        return stored === want || stored.includes(want) || want.includes(stored);
      }
      if (r.address) {
        return normalizeForSearch(r.address).includes(want);
      }
      return false;
    });
  }

  if (filters.street) {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const STOP_WORDS = new Set(["de", "del", "la", "las", "los", "el", "en", "y", "a", "un", "una", "calle", "paseo", "avenida", "avda", "plaza", "camino", "carretera"]);

    const searchWords = normalize(filters.street)
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

    if (searchWords.length > 0) {
      const addressText = (r: ListingRow) => [r.street, r.address].filter(Boolean).join(", ") || r.address || "";
      // Score each listing by how many significant search words appear in its address
      const scored = results
        .filter((r) => !!addressText(r))
        .map((r) => {
          const addr = normalize(addressText(r));
          const hits = searchWords.filter((w) => addr.includes(w)).length;
          return { listing: r, hits, ratio: hits / searchWords.length };
        });

      // Exact substring match first (original behavior)
      const searchStreet = normalize(filters.street);
      const exactMatches = scored.filter((s) => normalize(addressText(s.listing)).includes(searchStreet));
      if (exactMatches.length > 0) {
        results = exactMatches.map((s) => s.listing);
      } else {
        // Fuzzy: keep listings where at least 50% of significant words match
        const fuzzy = scored.filter((s) => s.ratio >= 0.5 && s.hits >= 1);
        if (fuzzy.length > 0) {
          fuzzy.sort((a, b) => b.ratio - a.ratio || b.hits - a.hits);
          results = fuzzy.map((s) => s.listing);
        } else {
          // No street match at all — don't filter by street so other filters can still narrow
          // (rooms, price, m2 will take over)
        }
      }
    }
  }

  if (filters.rooms !== undefined) {
    const targetRooms = Number(filters.rooms);
    results = results.filter((r) => {
      const listingRooms = Number(r.rooms);
      return Number.isFinite(listingRooms) && listingRooms === targetRooms;
    });
  }

  if (filters.price !== undefined) {
    // Price can vary slightly depending on listing refreshes or spoken rounding.
    const maxDelta = 150;
    const parsePrice = (value: unknown): number | undefined => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value !== "string") return undefined;
      const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    results = results.filter((r) => {
      const listingPrice = parsePrice(r.price);
      return listingPrice !== undefined && Math.abs(listingPrice - filters.price!) <= maxDelta;
    });
  }

  if (filters.m2 !== undefined) {
    const targetM2 = Number(filters.m2);
    const maxDeltaM2 = 10;
    results = results.filter((r) => {
      const listingM2 = Number(r.m2);
      return Number.isFinite(listingM2) && Math.abs(listingM2 - targetM2) <= maxDeltaM2;
    });
  }

  return results;
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
  hasResponse?: boolean;
} | null> {
  const snapshot = await getOrgDb().collection("leads").where("chatId", "==", chatId).get();
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
    hasResponse: data.hasResponse || false,
  };
}

/**
 * Resolve the organization ID for a given chatId by searching all leads globally.
 * If a lead belongs to multiple organizations, resolves to the one with the most recent activity.
 */
export async function findOrgIdByChatId(chatId: string): Promise<string | null> {
  const variants = getChatIdVariants(chatId);
  const phone = chatId.replace(/@(c\.us|s\.whatsapp\.net)$/, "").replace(/^whatsapp:/, "").replace(/^\+/, "");
  
  // Fetch matching leads from all organizations
  const [variantsSnapshot, phoneSnapshot] = await Promise.all([
    getDb().collectionGroup("leads").where("chatId", "in", variants).get(),
    getDb().collectionGroup("leads").where("phone", "==", phone).get(),
  ]);

  const allDocs = [...variantsSnapshot.docs, ...phoneSnapshot.docs];
  
  if (allDocs.length === 0) {
    return null;
  }

  // Deduplicate and sort by recency (lastMessageDate)
  const sortedMatches = allDocs
    .map(doc => ({
      orgId: doc.ref.path.split("/")[1],
      lastMessageDate: doc.data()?.lastMessageDate as FirebaseFirestore.Timestamp || null,
      docId: doc.id
    }))
    .sort((a, b) => {
      const timeA = a.lastMessageDate?.toMillis() || 0;
      const timeB = b.lastMessageDate?.toMillis() || 0;
      return timeB - timeA;
    });

  const bestMatch = sortedMatches[0];
  console.log(`Resolved orgId ${bestMatch.orgId} for chatId ${chatId} (Matches: ${allDocs.length}, Recency: ${bestMatch.lastMessageDate?.toDate().toISOString()})`);
  
  return bestMatch.orgId;
}

export async function findLeadByPhone(phone: string): Promise<{
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  qualificationStatus?: QualificationStatus;
  hasResponse?: boolean;
} | null> {
  // Get most recent lead for this phone
  const snapshot = await getOrgDb()
    .collection("leads")
    .where("phone", "==", phone)
    .orderBy("lastMessageDate", "desc")
    .limit(1)
    .get();

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
    qualificationStatus: data.qualificationStatus as QualificationStatus | undefined,
    hasResponse: data.hasResponse || false,
  };
}

export async function createLead(data: {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType?: OperationType;
  name?: string;
  qualificationStatus?: QualificationStatus;
  tags?: string[];
  recordings?: string[];
  leadSource?: string;
  listingResolutionStatus?: "pending" | "resolved" | "failed";
}): Promise<void> {
  const docId = buildLeadDocId(data.phone, data.listingCode);
  await getOrgDb().collection("leads").doc(docId).set({
    phone: data.phone,
    listingCode: data.listingCode,
    chatId: data.chatId,
    operationType: data.operationType,
    name: data.name,
    qualificationStatus: data.qualificationStatus,
    tags: data.tags,
    leadSource: data.leadSource,
    listingResolutionStatus: data.listingResolutionStatus,
    hasResponse: false,
    recordings: data.recordings || [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    firstMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Create a lead+conversation placeholder for call→WhatsApp handoff.
 * Uses a sentinel listingCode until we can resolve the listing from user text.
 */
export async function createPendingCallLead(params: {
  phone: string;
  chatId: string;
  name?: string;
}): Promise<void> {
  const sentinelListingCode = "__pending__";

  // Upsert lead (by phone+listingCode sentinel) so ensureConversationState treats it as a lead.
  await updateLeadChatInfo({
    phone: params.phone,
    listingCode: sentinelListingCode,
    chatId: params.chatId,
    name: params.name,
    qualificationStatus: "not_qualified",
    tags: ["lead", "call", "pending-listing"],
    recordings: [],
  });

  // Add extra metadata on the lead doc (by chatId) if possible.
  const snapshot = await getOrgDb().collection("leads").where("chatId", "==", params.chatId).limit(1).get();
  if (!snapshot.empty) {
    await snapshot.docs[0].ref.set(
      {
        leadSource: "call",
        listingResolutionStatus: "pending",
      },
      { merge: true }
    );
  }

  // Ensure there's a conversation doc to buffer messages into
  await upsertConversation(params.chatId, {
    phone: params.phone,
    chatId: params.chatId,
    listingCode: sentinelListingCode,
    history: [],
    pendingUserMessages: [],
    isFinished: false,
    botDisabled: false,
    type: "lead",
    tags: ["lead", "call", "pending-listing"],
  } as Partial<ConversationState>);
}

export async function updateLeadListingByChatId(params: {
  chatId: string;
  phone: string;
  listingCode: string;
  operationType?: OperationType;
  name?: string;
  listingResolutionStatus: "resolved" | "failed";
  tags?: string[];
}): Promise<void> {
  const snapshot = await getOrgDb().collection("leads").where("chatId", "==", params.chatId).limit(1).get();
  if (snapshot.empty) {
    console.warn(`No lead found with chatId ${params.chatId} to update listing`);
    return;
  }

  await snapshot.docs[0].ref.set(
    {
      phone: params.phone,
      listingCode: params.listingCode,
      ...(params.operationType ? { operationType: params.operationType } : {}),
      name: params.name,
      listingResolutionStatus: params.listingResolutionStatus,
      tags: params.tags,
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Store call→WhatsApp capture details (optional, for audit/debug).
 */
export async function upsertCallIntent(params: {
  callSid: string;
  fromPhone: string;
  capturedName?: string;
  createdAtMs?: number;
}): Promise<void> {
  const docRef = getOrgDb().collection("callIntents").doc(params.callSid);
  await docRef.set(
    {
      callSid: params.callSid,
      fromPhone: params.fromPhone,
      capturedName: params.capturedName,
      createdAtMs: params.createdAtMs ?? Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateLeadChatInfo(params: {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType?: OperationType;
  name?: string;
  qualificationStatus?: QualificationStatus;
  tags?: string[];
  recordings?: string[];
}): Promise<void> {
  const docId = buildLeadDocId(params.phone, params.listingCode);
  const docRef = getOrgDb().collection("leads").doc(docId);
  const snap = await docRef.get();
  const updateData: Record<string, unknown> = {
    phone: params.phone,
    listingCode: params.listingCode,
    chatId: params.chatId,
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!snap.exists) {
    const ts = admin.firestore.FieldValue.serverTimestamp();
    updateData.createdAt = ts;
    updateData.firstMessageDate = ts;
    updateData.hasResponse = false;
  }
  if (params.operationType !== undefined) {
    updateData.operationType = params.operationType;
  }

  if (params.name !== undefined) {
    updateData.name = params.name;
  }

  if (params.qualificationStatus !== undefined) {
    updateData.qualificationStatus = params.qualificationStatus;
  }

  if (params.tags !== undefined) {
    updateData.tags = params.tags;
  }

  if (params.recordings !== undefined) {
    updateData.recordings = admin.firestore.FieldValue.arrayUnion(...params.recordings);
  }

  await docRef.set(updateData, { merge: true });
}

// Conversations

/**
 * Get a conversation by chatId, searching all possible variants.
 * Returns the conversation data with the actual document ID.
 */
export async function getConversationByChatId(chatId: string): Promise<ConversationState | null> {
  const variants = getChatIdVariants(chatId);

  // Try each variant
  for (const variant of variants) {
    const docRef = getOrgDb().collection("conversations").doc(variant);
    const doc = await docRef.get();
    if (doc.exists) {
      return { ...doc.data(), chatId: doc.id } as ConversationState;
    }
  }

  return null;
}

/**
 * Find all conversation documents for a given chatId (checking all variants).
 * Returns array of [docId, data] pairs.
 */
async function findAllConversationVariants(chatId: string): Promise<[string, ConversationState][]> {
  const variants = getChatIdVariants(chatId);
  const results: [string, ConversationState][] = [];

  for (const variant of variants) {
    const docRef = getOrgDb().collection("conversations").doc(variant);
    const doc = await docRef.get();
    if (doc.exists) {
      results.push([doc.id, { ...doc.data(), chatId: doc.id } as ConversationState]);
    }
  }

  return results;
}

export async function getConversationByPhoneAndListing(phone: string, listingCode: string): Promise<ConversationState | null> {
  // Use leads collection to find the chatId because it has a composite index on [phone, listingCode]
  const snapshot = await getOrgDb()
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

/**
 * Upsert a conversation, ensuring we always use the canonical chatId format
 * and handle any existing duplicate variants by merging them.
 */
export async function upsertConversation(chatId: string, data: Partial<ConversationState>): Promise<void> {
  const canonicalChatId = normalizeToCanonicalChatId(chatId);

  // Find all existing variants
  const existingVariants = await findAllConversationVariants(chatId);

  // If we have multiple variants, we need to merge them
  if (existingVariants.length > 1) {
    console.log(`Found ${existingVariants.length} duplicate conversation variants for ${chatId}, merging to ${canonicalChatId}`);

    // Find the one with the most history (best data to keep)
    let bestData: ConversationState | null = null;
    let oldDocIds: string[] = [];

    for (const [docId, convData] of existingVariants) {
      if (!bestData || (convData.history?.length || 0) > (bestData.history?.length || 0)) {
        if (bestData) {
          // The previous best is now an old doc to delete
          const previousBestId = existingVariants.find(([_, d]) => d === bestData)?.[0];
          if (previousBestId && previousBestId !== canonicalChatId) {
            oldDocIds.push(previousBestId);
          }
        }
        bestData = convData;
      } else if (docId !== canonicalChatId) {
        oldDocIds.push(docId);
      }
    }

    // Merge the new data with the best existing data
    const mergedData = {
      ...bestData,
      ...data,
      chatId: canonicalChatId,
      messageCount: data.history?.length || bestData?.history?.length || 0,
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Write to canonical ID
    const canonicalRef = getOrgDb().collection("conversations").doc(canonicalChatId);
    await canonicalRef.set(mergedData, { merge: true });

    // Delete old variants
    for (const oldId of oldDocIds) {
      console.log(`Deleting duplicate conversation variant: ${oldId}`);
      await getOrgDb().collection("conversations").doc(oldId).delete();
    }

    return;
  }

  // If there's exactly one variant and it's not the canonical one, migrate it
  if (existingVariants.length === 1 && existingVariants[0][0] !== canonicalChatId) {
    const [oldDocId, oldData] = existingVariants[0];
    console.log(`Migrating conversation from ${oldDocId} to canonical ${canonicalChatId}`);

    const mergedData = {
      ...oldData,
      ...data,
      chatId: canonicalChatId,
      messageCount: data.history?.length || oldData.history?.length || 0,
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Write to canonical ID
    await getOrgDb().collection("conversations").doc(canonicalChatId).set(mergedData);

    // Delete old document
    await getOrgDb().collection("conversations").doc(oldDocId).delete();

    return;
  }

  // Normal case: no duplicates, just upsert to canonical ID
  const docRef = getOrgDb().collection("conversations").doc(canonicalChatId);
  await docRef.set(
    {
      ...data,
      chatId: canonicalChatId,
      messageCount: data.history?.length || 0,
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}


export async function appendConversationRow(params: {
  phone: string;
  chatId: string;
  listingCode?: string;
  history: HistoryItem[];
  name?: string;
  qualified?: boolean | null;
  isFinished?: boolean;
  recordings?: string[];
}): Promise<void> {
  await upsertConversation(params.chatId, {
    phone: params.phone,
    listingCode: params.listingCode,
    history: params.history,
    name: params.name,
    qualificationStatus: params.qualified ?? null,
    isFinished: params.isFinished,
    recordings: params.recordings,
  } as Partial<ConversationState>);
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
- VARÍA tu vocabulario de afirmaciones dependiendo del idioma de la conversación (ej. en español usa 'Genial', 'Estupendo', 'Vale', 'De acuerdo'; en inglés usa 'Great', 'Understood', 'Alright'), no repitas siempre lo mismo.`,
  },
  {
    id: "amigable",
    name: "Amigable y Cercano",
    description: "Tono cálido con emojis, más personalizado.",
    promptModifier: `- Usa un tono CÁLIDO y CERCANO, como si hablaras con un amigo.
- Incluye emojis ocasionales para dar calidez (😊, 👍, 🏠, ✨) pero sin exceso.
- Haz preguntas de una en una para que la conversación fluya naturalmente.
- Muestra entusiasmo genuino por ayudar al cliente a encontrar su hogar ideal.
- Usa expresiones cercanas acordes al idioma de la conversación (ej. en español "¡Qué bien!", "Me encanta", "¡Genial!"; en inglés "That's great!", "Awesome!").
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
- Agradece formalmente según el idioma: "Le agradezco su interés", "Gracias por su tiempo", o "Thank you for your time".`,
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
  const docRef = getOrgDb().collection("botConfig").doc("config");
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
  recordings?: string[];
  pets?: boolean;
  income?: number;
  paymentMethod?: "Contado" | "Hipoteca";
  notes?: string;
  conversationSummary?: string;
}): Promise<void> {
  const snapshot = await getOrgDb()
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

  if (params.pets !== undefined) {
    updateData.pets = params.pets;
  }

  if (params.income !== undefined) {
    updateData.income = params.income;
  }

  if (params.paymentMethod !== undefined) {
    updateData.paymentMethod = params.paymentMethod;
  }

  if (params.notes !== undefined) {
    updateData.notes = params.notes;
  }

  if (params.conversationSummary !== undefined) {
    updateData.conversationSummary = params.conversationSummary;
  }

  const hasConversationAnalysisFields =
    params.pets !== undefined ||
    params.income !== undefined ||
    params.paymentMethod !== undefined ||
    params.notes !== undefined ||
    params.conversationSummary !== undefined;
  if (hasConversationAnalysisFields) {
    updateData.lastAnalyzedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  if (params.recordings !== undefined) {
    updateData.recordings = admin.firestore.FieldValue.arrayUnion(...params.recordings);
  }

  await docRef.update(updateData);
}

/**
 * Add a recording URL to a lead by phone number
 */
export async function addRecordingByPhone(phone: string, recordingUrl: string): Promise<void> {
  const snapshot = await getOrgDb()
    .collection("leads")
    .where("phone", "==", phone)
    .orderBy("lastMessageDate", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.warn(`No lead found for phone ${phone} to add recording`);
    return;
  }

  await snapshot.docs[0].ref.update({
    recordings: admin.firestore.FieldValue.arrayUnion(recordingUrl),
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Mark a lead as having responded
 */
export async function markLeadAsResponded(chatId: string): Promise<void> {
  const snapshot = await getOrgDb()
    .collection("leads")
    .where("chatId", "==", chatId)
    .limit(1)
    .get();

  if (snapshot.empty) return;

  const docRef = snapshot.docs[0].ref;
  const data = snapshot.docs[0].data();

  // Only update if not already marked to save on writes
  if (!data.hasResponse) {
    await docRef.update({
      hasResponse: true,
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// ==================== MESSAGE BUFFER FUNCTIONS ====================

/**
 * Add a pending message to the conversation buffer
 */
export async function addPendingMessage(
  chatId: string,
  message: { text: string; timestamp: number }
): Promise<void> {
  const docRef = getOrgDb().collection("conversations").doc(chatId);

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
  const docRef = getOrgDb().collection("conversations").doc(chatId);

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
  const docRef = getOrgDb().collection("conversations").doc(chatId);

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
  const docRef = getOrgDb().collection("conversations").doc(chatId);
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

// ==================== FAILED MESSAGES QUEUE ====================

import { FailedMessage, SyncResult } from "../types";

/**
 * Add a message to the failed queue for retry
 */
export async function addFailedMessage(data: Omit<FailedMessage, "id">): Promise<string> {
  const docRef = await getOrgDb().collection("failedMessages").add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Get failed messages that are ready to be retried
 */
export async function getRetryableFailedMessages(): Promise<(FailedMessage & { id: string })[]> {
  const now = admin.firestore.Timestamp.now();

  const snapshot = await getDb()
    .collection("failedMessages")
    .where("nextRetryAt", "<=", now)
    .orderBy("nextRetryAt", "asc")
    .limit(50) // Process max 50 at a time
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as FailedMessage & { id: string }));
}

/**
 * Update a failed message after retry attempt
 */
export async function updateFailedMessageRetry(
  id: string,
  update: { attempt: number; nextRetryAt: FirebaseFirestore.Timestamp; lastError: string }
): Promise<void> {
  await getOrgDb().collection("failedMessages").doc(id).update(update);
}

/**
 * Delete a failed message (after successful retry or max attempts)
 */
export async function deleteFailedMessage(id: string): Promise<void> {
  await getOrgDb().collection("failedMessages").doc(id).delete();
}

/**
 * Get count of pending failed messages
 */
export async function getFailedMessageCount(): Promise<number> {
  const snapshot = await getOrgDb().collection("failedMessages").count().get();
  return snapshot.data().count;
}

// ==================== SYNC METRICS ====================

/**
 * Log sync result to Firestore for monitoring
 */
export async function logSyncResult(result: SyncResult): Promise<void> {
  await getOrgDb().collection("syncMetrics").add({
    ...result,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Get the most recent sync results
 */
export async function getRecentSyncResults(limit: number = 10): Promise<SyncResult[]> {
  const snapshot = await getDb()
    .collection("syncMetrics")
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as SyncResult);
}

/**
 * Get count of system alerts since a specific time
 */
export async function getAlertCountSince(since: Date): Promise<number> {
  const snapshot = await getDb()
    .collection("system_alerts")
    .where("timestamp", ">=", since)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Calculate response rate for leads created since a given date
 */
export async function getResponseRateStats(since: Date): Promise<{
  total: number;
  responded: number;
  rate: number;
}> {
  const leadsSnapshot = await getOrgDb().collection("leads")
    .where("createdAt", ">=", since)
    .get();

  const total = leadsSnapshot.size;
  if (total === 0) return { total: 0, responded: 0, rate: 0 };

  let responded = 0;
  for (const doc of leadsSnapshot.docs) {
    const data = doc.data();
    if (data.hasResponse) {
      responded++;
    } else {
      // Fallback: check historical data if flag not set (for old leads)
      const chatId = data.chatId;
      if (chatId) {
        const conv = await getConversationByChatId(chatId);
        if (conv && conv.history?.some(h => h.role === "user")) {
          responded++;
          // Proactive update: set the flag for this lead
          await doc.ref.update({ hasResponse: true });
        }
      }
    }
  }

  return {
    total,
    responded,
    rate: Math.round((responded / total) * 100)
  };
}

// ==================== STALE BUFFER DETECTION ====================

/**
 * Get conversations with stale buffers (pending messages older than threshold)
 */
export async function getStaleBuffers(maxAgeMinutes: number): Promise<ConversationState[]> {
  const cutoffMs = Date.now() - (maxAgeMinutes * 60 * 1000);

  const snapshot = await getDb()
    .collection("conversations")
    .where("bufferExpiresAt", "<", cutoffMs)
    .get();

  if (snapshot.empty) {
    return [];
  }

  // Filter to only include those with actual pending messages
  return snapshot.docs
    .map(doc => ({ ...doc.data(), chatId: doc.id } as ConversationState))
    .filter(conv => conv.pendingUserMessages && conv.pendingUserMessages.length > 0);
}

/**
 * Get all active (non-finished) conversations
 */
export async function getActiveConversations(): Promise<ConversationState[]> {
  const snapshot = await getDb()
    .collection("conversations")
    .where("isFinished", "==", false)
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => ({ ...doc.data(), chatId: doc.id } as ConversationState));
}

/**
 * Get conversations updated since a given date
 */
export async function getConversationsSince(since: Date): Promise<ConversationState[]> {
  const snapshot = await getDb()
    .collection("conversations")
    .where("lastMessage", ">=", since)
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => ({ ...doc.data(), chatId: doc.id } as ConversationState));
}
// ==================== IGNORED CHATS ====================

/**
 * Check if a chat is in the ignored list for sync
 */
export async function isChatIgnored(chatId: string): Promise<boolean> {
  const variants = getChatIdVariants(chatId);
  for (const variant of variants) {
    const doc = await getOrgDb().collection("ignoredChats").doc(variant).get();
    if (doc.exists) return true;
  }
  return false;
}
/**
 * Add a chat to the ignored list
 */
export async function ignoreChat(chatId: string): Promise<void> {
  const canonicalId = normalizeToCanonicalChatId(chatId);
  await getOrgDb().collection("ignoredChats").doc(canonicalId).set({
    chatId: canonicalId,
    ignoredAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ==================== LEAD ANALYSIS AGENT ====================

/**
 * Get all leads that have a chatId (needed for conversation analysis)
 */
export async function getAllLeadsWithChatId(): Promise<{ docId: string; data: Record<string, unknown> }[]> {
  const snapshot = await getOrgDb().collection("leads").get();
  const results: { docId: string; data: Record<string, unknown> }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.chatId) {
      results.push({ docId: doc.id, data });
    }
  }

  return results;
}

/**
 * Update a lead with analysis results.
 * Replaces all structured fields (pets, income, paymentMethod, notes) and sets lastAnalyzedAt.
 * Uses FieldValue.delete() for undefined values to remove stale data.
 */
export async function updateLeadAnalysis(docId: string, analysis: {
  pets?: boolean;
  income?: number;
  paymentMethod?: "Contado" | "Hipoteca";
  notes?: string;
  name?: string;
}): Promise<void> {
  const docRef = getOrgDb().collection("leads").doc(docId);
  const deleteField = admin.firestore.FieldValue.delete();

  const updateData: Record<string, unknown> = {
    pets: analysis.pets !== undefined ? analysis.pets : deleteField,
    income: analysis.income !== undefined ? analysis.income : deleteField,
    paymentMethod: analysis.paymentMethod !== undefined ? analysis.paymentMethod : deleteField,
    notes: analysis.notes !== undefined ? analysis.notes : deleteField,
    lastAnalyzedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (analysis.name !== undefined) {
    updateData.name = analysis.name;
  }

  await docRef.update(updateData);
}
