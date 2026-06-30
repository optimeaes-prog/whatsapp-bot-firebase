import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Conversation, HistoryItem } from "../types";
import { auth } from "../lib/firebase";

import { getOrganizationBasePath } from "../lib/organization";

function getConversationsCollection() {
  return `${getOrganizationBasePath()}/conversations`;
}

/**
 * Extract phone number from chatId (removes @c.us or @s.whatsapp.net suffix)
 */
export function extractPhoneFromId(id: string): string {
  return id.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
}

/** Same key as deduplicateByPhone (phone field or id stem). */
export function conversationPhoneKey(conv: Pick<Conversation, "phone" | "id">): string {
  return conv.phone || extractPhoneFromId(conv.id);
}

/**
 * After list deduplication, the selected document id may be absent from the list (duplicate chatId
 * variant). Remap to the row that is actually shown for that phone.
 */
export function alignSelectedConversationWithList(
  prev: Conversation,
  list: Conversation[]
): Conversation {
  const byId = list.find((c) => c.id === prev.id);
  if (byId) return byId;
  const key = conversationPhoneKey(prev);
  return list.find((c) => conversationPhoneKey(c) === key) ?? prev;
}

/**
 * Deduplicate conversations by phone number. When @c.us and @s.whatsapp.net both exist, the
 * document with the **longer history** must win: the other copy is often a partial row (e.g. only
 * user lines from an inbound path) while the canonical doc holds the full thread including the bot.
 * Only if lengths tie do we use recency, then canonical @s.whatsapp.net.
 */
function deduplicateByPhone(conversations: Conversation[]): Conversation[] {
  const byPhone = new Map<string, Conversation>();

  for (const conv of conversations) {
    // Extract phone from both the id and the phone field
    const phone = conv.phone || extractPhoneFromId(conv.id);
    const existing = byPhone.get(phone);

    if (!existing) {
      byPhone.set(phone, conv);
      continue;
    }

    const existingLen = existing.history?.length ?? 0;
    const convLen = conv.history?.length ?? 0;

    if (convLen > existingLen) {
      byPhone.set(phone, conv);
      continue;
    }
    if (convLen < existingLen) {
      continue;
    }

    const existingTime = existing.lastMessage?.toMillis?.() || 0;
    const convTime = conv.lastMessage?.toMillis?.() || 0;

    if (convTime > existingTime) {
      byPhone.set(phone, conv);
    } else if (convTime === existingTime) {
      const convCanonical = conv.id.endsWith("@s.whatsapp.net");
      const existingCanonical = existing.id.endsWith("@s.whatsapp.net");
      if (convCanonical && !existingCanonical) {
        byPhone.set(phone, conv);
      }
    }
  }

  // Return deduplicated array, sorted by lastMessage desc
  return Array.from(byPhone.values()).sort((a, b) => {
    const aTime = a.lastMessage?.toMillis?.() || 0;
    const bTime = b.lastMessage?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

export async function getConversations(): Promise<Conversation[]> {
  const q = query(
    collection(db, getConversationsCollection()),
    orderBy("lastMessage", "desc")
  );
  const snapshot = await getDocs(q);
  const rawConversations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversation[];

  // Deduplicate by phone number to handle legacy @c.us vs @s.whatsapp.net duplicates
  return deduplicateByPhone(rawConversations);
}

export async function getConversationsForAgent(agentUid: string): Promise<Conversation[]> {
  const uid = agentUid.trim();
  if (!uid) return [];
  const q = query(
    collection(db, getConversationsCollection()),
    where("assignedAgentUid", "==", uid)
  );
  const snapshot = await getDocs(q);
  const rawConversations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Conversation[];
  return deduplicateByPhone(rawConversations);
}

export function subscribeConversations(
  onChange: (conversations: Conversation[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(collection(db, getConversationsCollection()), orderBy("lastMessage", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Conversation[];
      onChange(deduplicateByPhone(raw));
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeConversationsForAgent(
  agentUid: string,
  onChange: (conversations: Conversation[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const uid = agentUid.trim();
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(db, getConversationsCollection()),
    where("assignedAgentUid", "==", uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Conversation[];
      onChange(deduplicateByPhone(raw));
    },
    (err) => onError?.(err)
  );
}

export function subscribeConversationById(
  id: string,
  onChange: (conversation: Conversation | null) => void,
  onError?: (error: unknown) => void
): () => void {
  const docRef = doc(db, getConversationsCollection(), id);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const conv = { id: snapshot.id, ...snapshot.data() } as Conversation;
      onChange(conv);
    },
    (err) => {
      onError?.(err);
    }
  );
}


export async function getConversationById(id: string): Promise<Conversation | null> {
  const docRef = doc(db, getConversationsCollection(), id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Conversation;
}

export async function getConversationByChatId(chatId: string): Promise<Conversation | null> {
  const q = query(collection(db, getConversationsCollection()), where("chatId", "==", chatId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Conversation;
}

export async function getConversationByChatIdForAgent(chatId: string, agentUid: string): Promise<Conversation | null> {
  const uid = agentUid.trim();
  if (!uid) return null;
  const q = query(
    collection(db, getConversationsCollection()),
    where("chatId", "==", chatId),
    where("assignedAgentUid", "==", uid)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Conversation;
}

export async function upsertConversation(
  chatId: string,
  data: {
    phone: string;
    listingCode: string;
    history: HistoryItem[];
    name?: string;
    qualified?: boolean | null;
    isFinished?: boolean;
  }
): Promise<void> {
  const docRef = doc(db, getConversationsCollection(), chatId);
  const existing = await getDoc(docRef);

  const now = Timestamp.now();
  const historyArray = data.history || [];

  const firestoreData = {
    phone: data.phone,
    listingCode: data.listingCode,
    history: data.history,
    name: data.name,
    qualified: data.qualified,
    isFinished: data.isFinished,
    chatId,
    messageCount: historyArray.length,
    lastMessage: now,
  };

  if (existing.exists()) {
    await setDoc(docRef, firestoreData, { merge: true });
  } else {
    await setDoc(docRef, {
      ...firestoreData,
      qualified: data.qualified ?? null,
      isFinished: data.isFinished ?? false,
    });
  }
}

export async function getActiveConversations(): Promise<Conversation[]> {
  const q = query(
    collection(db, getConversationsCollection()),
    where("isFinished", "==", false),
    orderBy("lastMessage", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversation[];
}

export async function deleteConversation(id: string): Promise<void> {
  const docRef = doc(db, getConversationsCollection(), id);
  await deleteDoc(docRef);
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, "notes" | "tags" | "name" | "botDisabled" | "listingCode" | "qualified" | "isFinished">>
): Promise<void> {
  const docRef = doc(db, getConversationsCollection(), id);
  // We use setDoc with merge: true because id is usually the chatId
  await setDoc(docRef, data, { merge: true });
}

export async function deleteConversationByChatId(chatId: string): Promise<void> {
  const q = query(collection(db, getConversationsCollection()), where("chatId", "==", chatId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const conversationDoc = snapshot.docs[0];
    await deleteDoc(doc(db, getConversationsCollection(), conversationDoc.id));
  }
}

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export async function sendMessageToWhatsApp(chatId: string, text: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Unauthorized");
  }
  const response = await fetch(`${FUNCTIONS_BASE_URL}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId, text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error sending message");
  }
}

export async function sendMassMessageToWhatsApp(chatIds: string[], text: string): Promise<any> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Unauthorized");
  }
  const response = await fetch(`${FUNCTIONS_BASE_URL}/sendMassMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ chatIds, text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error sending mass message");
  }

  return response.json();
}

export async function triggerAssistantResponse(chatId: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Unauthorized");
  }
  const response = await fetch(`${FUNCTIONS_BASE_URL}/triggerBot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error triggering assistant");
  }
}

export interface FollowUpDraftRequest {
  channel: "message" | "email";
  name?: string;
  operationType?: string;
  property?: string;
  note?: string;
  recentNotes?: string[];
  todayLabel?: string;
}

/** Pide al backend un borrador de mensaje de seguimiento generado con IA. Devuelve solo el texto. */
export async function generateFollowUpMessage(params: FollowUpDraftRequest): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Unauthorized");
  }
  const response = await fetch(`${FUNCTIONS_BASE_URL}/generateFollowUpMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Error generando el mensaje");
  }
  const data = await response.json();
  return (data.message as string) || "";
}

export async function retryMissingLeads(token: string, chatIds?: string[]): Promise<any> {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/retryMissingLeads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ chatIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error retrying missing leads");
  }

  return response.json();
}

