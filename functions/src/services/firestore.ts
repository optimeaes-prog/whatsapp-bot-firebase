import * as admin from "firebase-admin";
import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import {
  ListingRow,
  ListingForResolution,
  BotConfig,
  BotStyle,
  ConversationState,
  QualificationStatus,
  HistoryItem,
  OperationType,
  CloudApiConfig,
  CloudApiTemplateNames,
  GlobalMessagingPolicy,
  MessagingProvider,
  TwilioTemplateNames,
  TwilioTransportConfig,
} from "../types";
import { getChatIdVariants, normalizeToCanonicalChatId } from "../utils";
import { normalizeForSearch } from "../utils/addressNormalize";
import {
  pickLeadCandidate,
  fieldsToCarryOver,
  missingIdentityFields,
  shouldApplyQualificationStatus,
} from "./leadSelection";


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

import { getActiveOrgId, requestContext } from "./requestContext";

const getOrgDb = () => {
  return getDb().collection("organizations").doc(getActiveOrgId());
};

function agentDebugHash(value: unknown): string {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function agentDebugLog(
  runId: string,
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
): void {
  // #region agent log
  const payload = { sessionId: "831ae5", runId, hypothesisId, location, message, data, timestamp: Date.now() };
  console.log("AGENT_DEBUG", JSON.stringify(payload));
  fetch("http://127.0.0.1:7405/ingest/96d0f620-6747-4d94-83ba-426698967f63", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "831ae5" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

const GLOBAL_CONFIG_COLLECTION = "globalConfig";
const GLOBAL_MESSAGING_POLICY_DOC = "messagingPolicy";
const DEFAULT_PLATFORM_PROVIDER: MessagingProvider = "twilio";

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
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : undefined,
    assignedAgentUid: typeof data.assignedAgentUid === "string" ? data.assignedAgentUid : undefined,
    assignedAgentName: typeof data.assignedAgentName === "string" ? data.assignedAgentName : undefined,
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
    rentalSubtype: ((): "Vacacional" | "Temporada" | "Larga temporada" | "No aplica" | undefined => {
      const v = data.rentalSubtype;
      return v === "Vacacional" || v === "Temporada" || v === "Larga temporada" || v === "No aplica" ? v : undefined;
    })(),
    quickQualificationEnabled: data.quickQualificationEnabled === true,
    agentName: data.agentName,
    minMonthlyIncome: typeof data.minMonthlyIncome === "number" ? data.minMonthlyIncome : undefined,
    maxPeople: typeof data.maxPeople === "number" ? data.maxPeople : undefined,
    requireMortgageApproved: data.requireMortgageApproved === true,
  };
}

/** Agent scope UID from a raw Firestore listing document (assignedAgentUid else createdByUid). */
export function agentScopeFromListingSnapshotData(data: FirebaseFirestore.DocumentData | undefined): string {
  if (!data) return "";
  return getListingAgentScopeUid(listingRowFromDoc(data));
}

export function getListingAgentScopeUid(listing: ListingRow | null): string {
  if (!listing) return "";
  const assignedAgentUid = typeof listing.assignedAgentUid === "string" ? listing.assignedAgentUid.trim() : "";
  if (assignedAgentUid) return assignedAgentUid;
  return typeof listing.createdByUid === "string" ? listing.createdByUid.trim() : "";
}

/** Sets assignedAgentUid on all leads and conversations with this listingCode when it differs. */
export async function syncAssignedAgentUidForListingCode(listingCode: string, scopeUid: string): Promise<void> {
  const code = typeof listingCode === "string" ? listingCode.trim() : "";
  const uid = typeof scopeUid === "string" ? scopeUid.trim() : "";
  if (!code || code === "__pending__" || !uid) return;

  const [leadsSnap, convSnap] = await Promise.all([
    getOrgDb().collection("leads").where("listingCode", "==", code).get(),
    getOrgDb().collection("conversations").where("listingCode", "==", code).get(),
  ]);

  type WriteOp = { ref: FirebaseFirestore.DocumentReference; uid: string };
  const ops: WriteOp[] = [];
  for (const d of leadsSnap.docs) {
    const cur = typeof d.data().assignedAgentUid === "string" ? d.data().assignedAgentUid.trim() : "";
    if (cur !== uid) ops.push({ ref: d.ref, uid });
  }
  for (const d of convSnap.docs) {
    const cur = typeof d.data().assignedAgentUid === "string" ? d.data().assignedAgentUid.trim() : "";
    if (cur !== uid) ops.push({ ref: d.ref, uid });
  }
  if (ops.length === 0) return;

  const batchSize = 400;
  for (let i = 0; i < ops.length; i += batchSize) {
    const batch = getDb().batch();
    for (const op of ops.slice(i, i + batchSize)) {
      batch.set(op.ref, { assignedAgentUid: op.uid }, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Aligns leads and conversations for a listingCode with the listing's agent scope
 * (assignedAgentUid, else createdByUid). Call when assignment/ownership changes on the listing.
 */
export async function syncAgentScopeUidForListingCodeFromListingDoc(
  listingCode: string,
  listingDocData: FirebaseFirestore.DocumentData
): Promise<void> {
  const scopeUid = getListingAgentScopeUid(listingRowFromDoc(listingDocData));
  await syncAssignedAgentUidForListingCode(listingCode, scopeUid);
}

/**
 * For every org listing with a listingCode, re-apply agent scope to all matching leads/conversations.
 * Use after bulk assignment changes or historical drift (agent queries filter on assignedAgentUid).
 */
export async function reconcileAllListingAgentScopesInOrg(orgId: string): Promise<{
  listingDocs: number;
  listingsWithCodeAndScope: number;
}> {
  const trimmed = typeof orgId === "string" ? orgId.trim() : "";
  if (!trimmed) {
    return { listingDocs: 0, listingsWithCodeAndScope: 0 };
  }
  return requestContext.run({ orgId: trimmed }, async () => {
    const snap = await getOrgDb().collection("listings").get();
    let withCodeAndScope = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const code = typeof data.listingCode === "string" ? data.listingCode.trim() : "";
      if (!code || code === "__pending__") continue;
      const scope = getListingAgentScopeUid(listingRowFromDoc(data));
      if (!scope) continue;
      withCodeAndScope += 1;
      await syncAgentScopeUidForListingCodeFromListingDoc(code, data);
    }
    return { listingDocs: snap.docs.length, listingsWithCodeAndScope: withCodeAndScope };
  });
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

/**
 * The lead row that owns this conversation.
 *
 * Single entry point for "which lead is this chat about?". Every caller used to
 * run its own `.where("chatId", ...).limit(1)` and take the first document,
 * which meant the answer depended on how document ids happened to sort — so the
 * name could be saved on one row and the qualification on another. The rule now
 * lives in pickLeadCandidate; pass the conversation's current listing code when
 * it is known, so a lead interested in two properties gets the right row.
 *
 * Matches across chatId variants (suffix + Argentine "9" forms) so a lead saved
 * under one number form is found when the inbound arrives under another.
 */
export async function findLeadDocForChat(
  chatId: string,
  preferredListingCode?: string,
  /** Defaults to the active org. Cross-org flows pass the collection explicitly. */
  leadsCollection?: FirebaseFirestore.CollectionReference
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const snapshot = await (leadsCollection || getOrgDb().collection("leads"))
    .where("chatId", "in", getChatIdVariants(chatId))
    .get();
  if (snapshot.empty) return null;

  const chosen = pickLeadCandidate(
    // Stored fields first: a stray `id` field on a lead row must not shadow the
    // document id or the snapshot we need to write back to.
    snapshot.docs.map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id, doc })),
    preferredListingCode
  );
  if (!chosen) return null;

  if (snapshot.size > 1) {
    // Duplicated rows are a known data problem (a lead row used to be created per
    // phone+listing while the chat is per phone). Log it so the pairs are visible.
    console.warn(
      `Multiple lead rows for chat ${chatId}: ${snapshot.docs.map((d) => d.id).join(", ")} — using ${chosen.id}`
    );
  }
  return chosen.doc;
}

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
  callFlowMode?: "per_org" | "global_intake";
} | null> {
  // No listing preference here: this is what tells the conversation which listing
  // it is about, so there is nothing to prefer yet.
  const doc = await findLeadDocForChat(chatId);
  if (!doc) {
    return null;
  }
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
    callFlowMode: data.callFlowMode as ("per_org" | "global_intake" | undefined),
  };
}

/**
 * Resolve the organization ID for a given chatId by searching all leads globally.
 * If a lead belongs to multiple organizations, resolves to the one with the most recent activity.
 */
export async function findOrgIdByChatId(chatId: string): Promise<string | null> {
  const variants = getChatIdVariants(chatId);
  const phone = chatId.replace(/@(c\.us|s\.whatsapp\.net)$/, "").replace(/^whatsapp:/, "").replace(/^\+/, "");

  // First try active conversations: this is the strongest signal for inbound routing.
  // If the same phone exists in multiple orgs, the org with an open conversation should win.
  const activeConversationSnapshot = await getDb()
    .collectionGroup("conversations")
    .where("chatId", "in", variants)
    .get();

  if (!activeConversationSnapshot.empty) {
    const conversationCandidates = activeConversationSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const isFinished = data?.isFinished === true;
        const lastMessage =
          data?.lastMessage && typeof data.lastMessage.toMillis === "function"
            ? data.lastMessage.toMillis()
            : 0;
        return {
          orgId: doc.ref.path.split("/")[1],
          isFinished,
          lastMessage,
          flowStep: data?.flowStep || null,
          tags: Array.isArray(data?.tags) ? data.tags : [],
        };
      })
      .sort((a, b) => {
        // Prefer open conversations; then newest activity.
        if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
        return b.lastMessage - a.lastMessage;
      });
    const bestConversation = conversationCandidates[0];

    // #region agent log
    agentDebugLog("pre-fix", "H1,H3", "functions/src/services/firestore.ts:findOrgIdByChatId.conversations", "org resolution conversation candidates", {
      chatHash: agentDebugHash(chatId),
      candidateCount: conversationCandidates.length,
      candidates: conversationCandidates.slice(0, 5).map((candidate) => ({
        orgId: candidate.orgId,
        isFinished: candidate.isFinished,
        flowStep: candidate.flowStep,
        tags: candidate.tags,
        lastMessageAgeMs: candidate.lastMessage ? Date.now() - candidate.lastMessage : null,
      })),
      selectedOrgId: bestConversation.orgId,
    });
    // #endregion

    console.log(`Resolved orgId ${bestConversation.orgId} for chatId ${chatId} via active conversation routing`);
    return bestConversation.orgId;
  }

  // Fallback: Fetch matching leads from all organizations
  const [variantsSnapshot, phoneSnapshot] = await Promise.all([
    getDb().collectionGroup("leads").where("chatId", "in", variants).get(),
    getDb().collectionGroup("leads").where("phone", "==", phone).get(),
  ]);

  const allDocs = [...variantsSnapshot.docs, ...phoneSnapshot.docs];
  
  if (allDocs.length === 0) {
    // #region agent log
    agentDebugLog("pre-fix", "H1", "functions/src/services/firestore.ts:findOrgIdByChatId.noMatch", "org resolution no lead match", {
      chatHash: agentDebugHash(chatId),
    });
    // #endregion
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
  // #region agent log
  agentDebugLog("pre-fix", "H1,H3", "functions/src/services/firestore.ts:findOrgIdByChatId.leads", "org resolution lead candidates", {
    chatHash: agentDebugHash(chatId),
    candidateCount: sortedMatches.length,
    candidates: sortedMatches.slice(0, 5).map((candidate) => ({
      orgId: candidate.orgId,
      lastMessageDateMs: candidate.lastMessageDate?.toMillis() || 0,
    })),
    selectedOrgId: bestMatch.orgId,
  });
  // #endregion
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
  callFlowMode?: "per_org" | "global_intake";
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
    callFlowMode: data.callFlowMode as ("per_org" | "global_intake" | undefined),
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
  const listing = data.listingCode ? await fetchListingByCode(data.listingCode).catch(() => null) : null;
  const assignedAgentUid = getListingAgentScopeUid(listing);
  await getOrgDb().collection("leads").doc(docId).set({
    phone: data.phone,
    listingCode: data.listingCode,
    chatId: data.chatId,
    operationType: data.operationType,
    name: data.name,
    qualificationStatus: data.qualificationStatus,
    ...(assignedAgentUid ? { assignedAgentUid } : {}),
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
  /**
   * Marks the inbound-call processing mode. "per_org" routes the conversation through
   * the in-place (no-handoff) flow; absent = legacy global-intake + handoff.
   */
  callFlowMode?: "per_org" | "global_intake";
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

  // Metadata goes on the placeholder row this call just created, addressed
  // directly. Looking it up by chat would find whichever row the caller already
  // has — and marking an existing property's lead "pending resolution" would be
  // a lie about that property.
  await getOrgDb()
    .collection("leads")
    .doc(buildLeadDocId(params.phone, sentinelListingCode))
    .set(
      {
        leadSource: "call",
        listingResolutionStatus: "pending",
        ...(params.callFlowMode ? { callFlowMode: params.callFlowMode } : {}),
      },
      { merge: true }
    );

  // Ensure there's a conversation doc to buffer messages into.
  // IMPORTANT: only initialize transient fields (history, pendingUserMessages, isFinished, tags)
  // when the doc DOESN'T already exist. Otherwise we'd clobber buffered inbound messages and
  // a previously-completed handoff state on repeat callers — see the voiceWebhook race we hit.
  const canonicalChatId = normalizeToCanonicalChatId(params.chatId);
  const existingConv = await getOrgDb().collection("conversations").doc(canonicalChatId).get();
  if (!existingConv.exists) {
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
      ...(params.callFlowMode ? { callFlowMode: params.callFlowMode } : {}),
    } as Partial<ConversationState>);
  } else {
    // Doc exists — only refresh identity fields, leave transient state alone.
    // callFlowMode is an identity field (it reflects which number was dialed this call),
    // so refresh it too in case a repeat caller's prior conversation predates per-org mode.
    await upsertConversation(params.chatId, {
      phone: params.phone,
      chatId: params.chatId,
      type: "lead",
      ...(params.callFlowMode ? { callFlowMode: params.callFlowMode } : {}),
    } as Partial<ConversationState>);
  }
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
  // The call flow has worked out which property the caller meant.
  const leadDoc = await findLeadDocForChat(params.chatId);
  if (!leadDoc) {
    console.warn(`No lead found with chatId ${params.chatId} to update listing`);
    return;
  }

  let scopeForSync = "";
  let assignedPatch: Record<string, string> = {};
  if (params.listingCode && params.listingCode !== "__pending__") {
    const listing = await fetchListingByCode(params.listingCode).catch(() => null);
    const assignedAgentUid = getListingAgentScopeUid(listing);
    if (assignedAgentUid) {
      assignedPatch = { assignedAgentUid };
      scopeForSync = assignedAgentUid;
    }
  }

  // Undefined keys are dropped rather than kept: spreading this patch over the
  // fields carried from another row must not blank them out. `{...{name: "Ana"},
  // ...{name: undefined}}` is `{name: undefined}`, which would silently lose the
  // name the call had captured.
  const patch: Record<string, unknown> = Object.fromEntries(
    Object.entries({
      phone: params.phone,
      listingCode: params.listingCode,
      operationType: params.operationType,
      name: params.name,
      listingResolutionStatus: params.listingResolutionStatus,
      tags: params.tags,
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
      ...assignedPatch,
    }).filter(([, value]) => value !== undefined)
  );

  const isRealListing = Boolean(params.listingCode) && params.listingCode !== "__pending__";
  const source = (leadDoc.data() || {}) as Record<string, unknown>;
  const leads = getOrgDb().collection("leads");
  // Go straight to the placeholder rather than to whichever row the chat lookup
  // returns: a caller may already have a row for another property, and that row
  // is that property's lead — it must never be repurposed.
  const placeholderRef = leads.doc(buildLeadDocId(params.phone, "__pending__"));
  const placeholderSnap = await placeholderRef.get();

  if (!isRealListing) {
    // The call flow gave up on identifying the property. Record that on the
    // placeholder, never stamping "__pending__" over a row that owns a real one.
    if (placeholderSnap.exists) {
      await placeholderRef.set(patch, { merge: true });
    } else {
      const withoutListing = { ...patch };
      delete withoutListing.listingCode;
      await leadDoc.ref.set(withoutListing, { merge: true });
    }
    return;
  }

  const targetRef = leads.doc(buildLeadDocId(params.phone, params.listingCode));

  if (placeholderSnap.exists) {
    // A call lead starts filed under the "__pending__" placeholder because nobody
    // knows the property yet. Now that we do, the row MOVES to its real identity.
    // Writing the code into a row still filed as "__pending__" is exactly what
    // produced the duplicates: the next write looked for the row of that
    // property, found none, and created a second one.
    await getDb().runTransaction(async (tx) => {
      // All reads before any write — Firestore requires that order.
      const fromSnap = await tx.get(placeholderRef);
      const toSnap = await tx.get(targetRef);
      const from = (fromSnap.data() || {}) as Record<string, unknown>;
      const to = (toSnap.data() || {}) as Record<string, unknown>;
      // Whatever the placeholder learned during the call — the name, the consent
      // proof, when it started — comes along, unless the destination already
      // knows better. Moving atomically means the proof can never be dropped.
      tx.set(targetRef, { ...fieldsToCarryOver(to, from), ...patch }, { merge: true });
      if (fromSnap.exists) tx.delete(placeholderRef);
    });
  } else {
    // No placeholder: the chat is confirming, or moving on to, a real property.
    // It gets its own row, carrying only who the person is — never the other
    // property's qualification.
    const targetSnap = await targetRef.get();
    const identity = missingIdentityFields(
      (targetSnap.data() || {}) as Record<string, unknown>,
      source
    );
    const created = targetSnap.exists
      ? {}
      : {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        firstMessageDate: admin.firestore.FieldValue.serverTimestamp(),
        hasResponse: false,
      };
    await targetRef.set({ ...identity, ...created, chatId: params.chatId, ...patch }, { merge: true });
  }

  if (scopeForSync && isRealListing) {
    await syncAssignedAgentUidForListingCode(params.listingCode, scopeForSync);
  }
}

/**
 * Mirror the person's own details onto every lead row of the same chat.
 *
 * A lead interested in two properties has two rows but one conversation, so the
 * name or the consent proof would otherwise sit only on whichever row was
 * current when the bot learned it, leaving the other looking empty. Only fills
 * gaps: a row that already has a value keeps it.
 */
export async function syncLeadIdentityAcrossChat(params: {
  chatId: string;
  identity: Record<string, unknown>;
  skipDocId?: string;
}): Promise<void> {
  const identity = Object.fromEntries(
    Object.entries(params.identity).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(identity).length === 0) return;

  const snapshot = await getOrgDb()
    .collection("leads")
    .where("chatId", "in", getChatIdVariants(params.chatId))
    .get();
  if (snapshot.size <= 1) return;

  await Promise.all(
    snapshot.docs
      .filter((doc) => doc.id !== params.skipDocId)
      .map(async (doc) => {
        const patch = missingIdentityFields(doc.data() as Record<string, unknown>, identity);
        if (Object.keys(patch).length === 0) return;
        await doc.ref.set(patch, { merge: true });
      })
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
  callFlowMode?: "per_org" | "global_intake";
}): Promise<void> {
  // Moved to organizations/{orgId}/calls to align with multi-tenant structure
  const docRef = getOrgDb().collection("calls").doc(params.callSid);
  await docRef.set(
    {
      callSid: params.callSid,
      fromPhone: params.fromPhone,
      capturedName: params.capturedName,
      createdAtMs: params.createdAtMs ?? Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(params.callFlowMode ? { callFlowMode: params.callFlowMode } : {}),
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
  // One lead row per person PER PROPERTY: a lead interested in two ads is two
  // rows, on purpose. The row is keyed by phone + listing code, so the same
  // person asking again about the same ad updates their row instead of adding one.
  const docId = buildLeadDocId(params.phone, params.listingCode);
  const docRef = getOrgDb().collection("leads").doc(docId);
  const snap = await docRef.get();
  const updateData: Record<string, unknown> = {
    phone: params.phone,
    listingCode: params.listingCode,
    chatId: params.chatId,
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (params.listingCode && params.listingCode !== "__pending__") {
    const listing = await fetchListingByCode(params.listingCode).catch(() => null);
    const assignedAgentUid = getListingAgentScopeUid(listing);
    if (assignedAgentUid) {
      updateData.assignedAgentUid = assignedAgentUid;
    }
  }

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

  if (
    params.qualificationStatus !== undefined &&
    shouldApplyQualificationStatus(
      snap.data()?.qualificationStatus as string | undefined,
      params.qualificationStatus
    )
  ) {
    updateData.qualificationStatus = params.qualificationStatus;
  }

  if (params.tags !== undefined) {
    updateData.tags = params.tags;
  }

  if (params.recordings !== undefined && params.recordings.length > 0) {
    updateData.recordings = admin.firestore.FieldValue.arrayUnion(...params.recordings);
  }

  await docRef.set(updateData, { merge: true });
}

// Conversations

/**
 * Union duplicate chatId variants' histories (and optional incoming update) without dropping rows.
 * Dedupes by role + timestamp + text, sorts by timestamp ascending.
 */
export function mergeConversationHistoryItems(...groups: (HistoryItem[] | undefined)[]): HistoryItem[] {
  const map = new Map<string, HistoryItem>();
  for (const group of groups) {
    for (const h of group || []) {
      if (!h || typeof h.text !== "string") continue;
      const role: HistoryItem["role"] = h.role === "assistant" ? "assistant" : "user";
      const key = `${role}:${h.timestamp}:${h.text}`;
      if (!map.has(key)) {
        map.set(key, { role, text: h.text, timestamp: h.timestamp });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get a conversation by chatId, searching all possible variants.
 * When both @c.us and @s.whatsapp.net exist (legacy duplicates), returns the document with the
 * richest history — not simply the first variant in fixed order (which hid assistant rows on canonical docs).
 */
export async function getConversationByChatId(chatId: string): Promise<ConversationState | null> {
  const variants = getChatIdVariants(chatId);
  const found: ConversationState[] = [];

  for (const variant of variants) {
    const docRef = getOrgDb().collection("conversations").doc(variant);
    const doc = await docRef.get();
    if (doc.exists) {
      found.push({ ...doc.data(), chatId: doc.id } as ConversationState);
    }
  }

  if (found.length === 0) return null;
  if (found.length === 1) return found[0];

  const canonicalId = normalizeToCanonicalChatId(chatId);
  return found.reduce((best, cur) => {
    const bl = best.history?.length ?? 0;
    const cl = cur.history?.length ?? 0;
    if (cl > bl) return cur;
    if (cl < bl) return best;
    if (cur.chatId === canonicalId) return cur;
    if (best.chatId === canonicalId) return best;
    return best;
  });
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

    const bestPair = existingVariants.reduce((best, cur) => {
      const bl = best[1].history?.length ?? 0;
      const cl = cur[1].history?.length ?? 0;
      return cl > bl ? cur : best;
    });
    const [, bestData] = bestPair;

    const allHistories = existingVariants.map(([, c]) => c.history);
    const unionHistory = mergeConversationHistoryItems(...allHistories);
    const { history: incomingHistory, ...rest } = data;
    const finalHistory =
      incomingHistory !== undefined
        ? mergeConversationHistoryItems(unionHistory, incomingHistory)
        : unionHistory;

    const mergedData = {
      ...bestData,
      ...rest,
      history: finalHistory,
      messageCount: finalHistory.length,
      chatId: canonicalChatId,
      lastMessage: admin.firestore.FieldValue.serverTimestamp(),
    };

    const canonicalRef = getOrgDb().collection("conversations").doc(canonicalChatId);
    await canonicalRef.set(mergedData, { merge: true });

    for (const [variantId] of existingVariants) {
      if (variantId !== canonicalChatId) {
        console.log(`Deleting duplicate conversation variant: ${variantId}`);
        await getOrgDb().collection("conversations").doc(variantId).delete();
      }
    }

    return;
  }

  // If there's exactly one variant and it's not the canonical one, migrate it
  if (existingVariants.length === 1 && existingVariants[0][0] !== canonicalChatId) {
    const [oldDocId, oldData] = existingVariants[0];
    console.log(`Migrating conversation from ${oldDocId} to canonical ${canonicalChatId}`);

    const { history: incomingHistory, ...rest } = data;
    const finalHistory =
      incomingHistory !== undefined
        ? mergeConversationHistoryItems(oldData.history, incomingHistory)
        : oldData.history || [];

    const mergedData = {
      ...oldData,
      ...rest,
      history: finalHistory,
      messageCount: finalHistory.length,
      chatId: canonicalChatId,
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
  const [existingPair] = existingVariants;
  const existingHist = existingPair?.[1]?.history;
  const { history: incomingHistory, ...rest } = data;

  const payload: Record<string, unknown> = {
    ...rest,
    chatId: canonicalChatId,
    lastMessage: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (incomingHistory !== undefined) {
    const merged = mergeConversationHistoryItems(existingHist, incomingHistory);
    payload.history = merged;
    payload.messageCount = merged.length;
  }

  await docRef.set(payload, { merge: true });
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
  const listingCode = typeof params.listingCode === "string" ? params.listingCode.trim() : "";
  const listing = listingCode && listingCode !== "__pending__"
    ? await fetchListingByCode(listingCode).catch(() => null)
    : null;
  const assignedAgentUid = getListingAgentScopeUid(listing);

  await upsertConversation(params.chatId, {
    phone: params.phone,
    listingCode: params.listingCode,
    ...(assignedAgentUid ? { assignedAgentUid } : {}),
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

export async function getGlobalMessagingPolicy(): Promise<GlobalMessagingPolicy> {
  const docRef = getDb().collection(GLOBAL_CONFIG_COLLECTION).doc(GLOBAL_MESSAGING_POLICY_DOC);
  const doc = await docRef.get();
  if (!doc.exists) {
    const bootstrap: GlobalMessagingPolicy = {
      defaultProvider: DEFAULT_PLATFORM_PROVIDER,
      version: 1,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: "system_bootstrap",
    };
    await docRef.set(bootstrap, { merge: true });
    return bootstrap;
  }
  const data = doc.data() as GlobalMessagingPolicy;
  return {
    ...data,
    defaultProvider: data.defaultProvider || DEFAULT_PLATFORM_PROVIDER,
  };
}

export async function updateGlobalMessagingPolicy(params: {
  patch: Partial<GlobalMessagingPolicy>;
  updatedBy: string;
}): Promise<GlobalMessagingPolicy> {
  const docRef = getDb().collection(GLOBAL_CONFIG_COLLECTION).doc(GLOBAL_MESSAGING_POLICY_DOC);
  await docRef.set(
    {
      ...params.patch,
      updatedBy: params.updatedBy,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      version: admin.firestore.FieldValue.increment(1),
    },
    { merge: true }
  );
  return getGlobalMessagingPolicy();
}

export async function setPlatformDefaultProvider(params: {
  provider: MessagingProvider;
  updatedBy: string;
}): Promise<GlobalMessagingPolicy> {
  return updateGlobalMessagingPolicy({
    patch: { defaultProvider: params.provider },
    updatedBy: params.updatedBy,
  });
}

export async function getActiveStyle(): Promise<BotStyle> {
  const config = await getBotConfig();
  const activeStyle = config.styles.find((s) => s.id === config.activeStyleId);
  return activeStyle || DEFAULT_STYLES[0];
}

/**
 * Merge-update the Cloud API configuration on the org's botConfig document.
 * Accepts a partial CloudApiConfig; fields that aren't included are left untouched.
 */
export async function updateCloudApiConfig(patch: Partial<CloudApiConfig>): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  if (Object.keys(cleaned).length === 0) return;
  const docRef = getOrgDb().collection("botConfig").doc("config");
  await docRef.set({ cloudApiConfig: cleaned }, { merge: true });
}

/**
 * Persist the template names generated via `createCloudApiTemplates`.
 */
export async function updateCloudApiTemplates(templates: CloudApiTemplateNames): Promise<void> {
  const docRef = getOrgDb().collection("botConfig").doc("config");
  await docRef.set({ cloudApiConfig: { templates } }, { merge: true });
}

export async function updateTwilioTemplates(templates: TwilioTemplateNames): Promise<void> {
  const docRef = getOrgDb().collection("botConfig").doc("config");
  await docRef.set({ twilioTemplates: templates }, { merge: true });
}

export async function updateTwilioConfig(patch: Partial<TwilioTransportConfig>): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  if (Object.keys(cleaned).length === 0) return;
  const docRef = getOrgDb().collection("botConfig").doc("config");
  await docRef.set({ twilioConfig: cleaned }, { merge: true });
}

export async function getOrganizationMessagingProvider(orgId: string): Promise<MessagingProvider | undefined> {
  const doc = await getDb().doc(`organizations/${orgId}/botConfig/config`).get();
  const value = doc.data()?.messagingProvider;
  if (value === "cloud_api" || value === "twilio") return value;
  return undefined;
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
  visitAvailability?: string;
  notes?: string;
  conversationSummary?: string;
  /** The property the conversation is about, so the status lands on its row. */
  listingCode?: string;
}): Promise<void> {
  const leadDoc = await findLeadDocForChat(params.chatId, params.listingCode);

  if (!leadDoc) {
    console.warn(`No lead found with chatId ${params.chatId}`);
    return;
  }

  const docRef = leadDoc.ref;
  const updateData: Record<string, unknown> = {
    lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (
    shouldApplyQualificationStatus(
      leadDoc.data()?.qualificationStatus as string | undefined,
      params.qualificationStatus
    )
  ) {
    updateData.qualificationStatus = params.qualificationStatus;
  }

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

  if (params.visitAvailability !== undefined) {
    updateData.visitAvailability = params.visitAvailability;
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
    params.visitAvailability !== undefined ||
    params.notes !== undefined ||
    params.conversationSummary !== undefined;
  if (hasConversationAnalysisFields) {
    updateData.lastAnalyzedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  if (params.recordings !== undefined) {
    updateData.recordings = admin.firestore.FieldValue.arrayUnion(...params.recordings);
  }

  await docRef.update(updateData);

  // The name belongs to the person, not to one of their properties.
  if (params.name !== undefined) {
    await syncLeadIdentityAcrossChat({
      chatId: params.chatId,
      identity: { name: params.name },
      skipDocId: docRef.id,
    }).catch((error) => console.warn("Failed to mirror lead name across rows", error));
  }
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
export async function markLeadAsResponded(chatId: string, listingCode?: string): Promise<void> {
  const leadDoc = await findLeadDocForChat(chatId, listingCode);

  if (!leadDoc) return;

  const docRef = leadDoc.ref;
  const data = leadDoc.data();

  // Only update if not already marked to save on writes
  if (!data.hasResponse) {
    await docRef.update({
      hasResponse: true,
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

type LeadConsentSource =
  | "idealista_form"
  | "agency_website"
  | "phone_call"
  | "in_person"
  | "inbound_whatsapp";

type LeadConsentPayload = {
  capturedAt: FirebaseFirestore.Timestamp;
  source: LeadConsentSource;
  collectedBy?: string;
  language?: "es" | "en";
  proofUrl?: string;
};

/**
 * Persist/replace consent metadata for a lead by document id.
 */
export async function setLeadConsentByLeadId(params: {
  leadId: string;
  consent: LeadConsentPayload;
}): Promise<void> {
  const docRef = getOrgDb().collection("leads").doc(params.leadId);
  await docRef.set(
    {
      consent: params.consent,
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Upsert explicit consent on the lead linked to this chatId.
 * Returns the affected lead id, or null if lead could not be found/created.
 */
export async function setLeadConsentByChatId(params: {
  chatId: string;
  phone?: string;
  listingCode?: string;
  operationType?: OperationType;
  consent: LeadConsentPayload & {
    proofType?: "twilio_call_sid" | "twilio_recording_sid" | "wa_inbound";
    consentScriptVersion?: string;
    dtmfDigit?: "1";
  };
}): Promise<{ leadId: string } | null> {
  const leadsRef = getOrgDb().collection("leads");
  const existing = await findLeadDocForChat(params.chatId, params.listingCode);

  if (!existing) {
    if (!params.phone || !params.listingCode) return null;
    const docRef = leadsRef.doc(buildLeadDocId(params.phone, params.listingCode));
    await docRef.set(
      {
        phone: params.phone,
        listingCode: params.listingCode,
        chatId: params.chatId,
        operationType: params.operationType,
        consent: params.consent,
        hasResponse: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        firstMessageDate: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { leadId: docRef.id };
  }

  const docRef = existing.ref;
  await docRef.set(
    {
      consent: params.consent,
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  // Consent is given by the person, so it holds for every property they asked about.
  await syncLeadIdentityAcrossChat({
    chatId: params.chatId,
    identity: { consent: params.consent, phone: params.phone },
    skipDocId: docRef.id,
  }).catch((error) => console.warn("Failed to mirror consent across rows", error));
  return { leadId: docRef.id };
}

/**
 * Persist a call handoff event for auditability and troubleshooting.
 * Stored under the source org (global intake org).
 */
export async function recordCallHandoffEvent(params: {
  sourceOrgId: string;
  correlationId: string;
  chatId: string;
  phone: string;
  language?: "es" | "en";
  status: "pending" | "transferred" | "failed";
  targetOrgId?: string;
  matchedListingCode?: string;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  const docRef = db
    .doc(`organizations/${params.sourceOrgId}/callHandoffs/${params.correlationId}`);

  await docRef.set(
    {
      correlationId: params.correlationId,
      chatId: params.chatId,
      phone: params.phone,
      language: params.language || null,
      sourceOrgId: params.sourceOrgId,
      targetOrgId: params.targetOrgId || null,
      matchedListingCode: params.matchedListingCode || null,
      status: params.status,
      reason: params.reason || null,
      transferredAt: params.status === "transferred" ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Auto-stamp implicit inbound WhatsApp consent once for the lead bound to this chat.
 * Returns the lead doc id when consent was newly created.
 */
export async function ensureInboundWhatsAppConsentByChatId(params: {
  chatId: string;
  proofUrl?: string;
  language?: "es" | "en";
  listingCode?: string;
}): Promise<{ leadId: string } | null> {
  const doc = await findLeadDocForChat(params.chatId, params.listingCode);
  if (!doc) return null;

  const data = doc.data() as { consent?: unknown } | undefined;
  if (data?.consent) {
    return null;
  }

  await doc.ref.set(
    {
      consent: {
        capturedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "inbound_whatsapp",
        language: params.language || "es",
        proofUrl: params.proofUrl || undefined,
      },
      lastMessageDate: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

    // Same person, same consent: mirror it onto their other properties' rows.
  await syncLeadIdentityAcrossChat({
    chatId: params.chatId,
    identity: {
      consent: {
        capturedAt: admin.firestore.Timestamp.now(),
        source: "inbound_whatsapp",
        language: params.language || "es",
        proofUrl: params.proofUrl || undefined,
      },
    },
    skipDocId: doc.id,
  }).catch((error) => console.warn("Failed to mirror inbound consent across rows", error));

  return { leadId: doc.id };
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
  // syncMetrics stays at root as per user request
  await getDb().collection("syncMetrics").add({
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

  const snapshot = await getOrgDb()
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
  const snapshot = await getOrgDb()
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
  const snapshot = await getOrgDb()
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
