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
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Conversation, HistoryItem } from "../types";

const COLLECTION_NAME = "conversations";

export async function getConversations(): Promise<Conversation[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("lastMessage", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversation[];
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
    orderBy("lastMessage", "desc"),
    limit(50)
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
  data: Partial<Pick<Conversation, "notes" | "tags" | "name">>
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
