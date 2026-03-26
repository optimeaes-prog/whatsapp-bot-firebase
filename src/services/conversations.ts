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
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Conversation, HistoryItem } from "../types";

import { getOrganizationBasePath } from "../lib/organization";

const COLLECTION_NAME = `${getOrganizationBasePath()}/conversations`;

/**
 * Extract phone number from chatId (removes @c.us or @s.whatsapp.net suffix)
 */
function extractPhoneFromId(id: string): string {
  return id.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
}

/**
 * Deduplicate conversations by phone number, keeping the one with the most recent message
 * or the most history items if timestamps are equal.
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

    // Compare by lastMessage timestamp, then by message count
    const existingTime = existing.lastMessage?.toMillis?.() || 0;
    const convTime = conv.lastMessage?.toMillis?.() || 0;

    if (convTime > existingTime) {
      byPhone.set(phone, conv);
    } else if (convTime === existingTime) {
      // Same timestamp, prefer the one with more history
      if ((conv.history?.length || 0) > (existing.history?.length || 0)) {
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
    collection(db, COLLECTION_NAME),
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


export async function getConversationById(id: string): Promise<Conversation | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Conversation;
}

export async function getConversationByChatId(chatId: string): Promise<Conversation | null> {
  const q = query(collection(db, COLLECTION_NAME), where("chatId", "==", chatId));
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
  const docRef = doc(db, COLLECTION_NAME, chatId);
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
    collection(db, COLLECTION_NAME),
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
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, "notes" | "tags" | "name" | "botDisabled" | "listingCode" | "qualified" | "isFinished">>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  // We use setDoc with merge: true because id is usually the chatId
  await setDoc(docRef, data, { merge: true });
}

export async function deleteConversationByChatId(chatId: string): Promise<void> {
  const q = query(collection(db, COLLECTION_NAME), where("chatId", "==", chatId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const conversationDoc = snapshot.docs[0];
    await deleteDoc(doc(db, COLLECTION_NAME, conversationDoc.id));
  }
}

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export async function sendMessageToWhatsApp(chatId: string, text: string): Promise<void> {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chatId, text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error sending message");
  }
}

export async function sendMassMessageToWhatsApp(chatIds: string[], text: string): Promise<any> {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/sendMassMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chatIds, text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error sending mass message");
  }

  return response.json();
}

export async function triggerBotResponse(chatId: string): Promise<void> {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/triggerBot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chatId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error triggering bot");
  }
}

