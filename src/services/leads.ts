import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Lead, LeadFormData } from "../types";

const COLLECTION_NAME = "leads";

export async function getLeads(): Promise<Lead[]> {
  const q = query(
    collection(db, COLLECTION_NAME), 
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Lead[];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Lead;
}

export async function getLeadByChatId(chatId: string): Promise<Lead | null> {
  const q = query(collection(db, COLLECTION_NAME), where("chatId", "==", chatId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Lead;
}

export async function createLead(data: LeadFormData): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateLeadChatInfo(
  telefono: string,
  anuncio: string,
  chatId: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("telefono", "==", telefono),
    where("anuncio", "==", anuncio)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`Lead not found for telefono ${telefono} and anuncio ${anuncio}`);
  }
  const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
  await updateDoc(docRef, { chatId });
}
