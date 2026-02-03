import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { QualifiedLead } from "../types";

const COLLECTION_NAME = "qualifiedLeads";

export async function getQualifiedLeads(): Promise<QualifiedLead[]> {
  const q = query(
    collection(db, COLLECTION_NAME), 
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as QualifiedLead[];
}

export async function getQualifiedLeadById(id: string): Promise<QualifiedLead | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as QualifiedLead;
}

export async function createQualifiedLead(data: {
  phone: string;
  chatId: string;
  listingCode: string;
  conversationSummary: string;
  name: string;
  qualified: boolean;
}): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    phone: data.phone,
    chatId: data.chatId,
    listingCode: data.listingCode,
    conversationSummary: data.conversationSummary,
    name: data.name,
    qualified: data.qualified,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Obtener leads cualificados por listingCode
export async function getQualifiedLeadsByListingCode(listingCode: string): Promise<QualifiedLead[]> {
  const allLeads = await getQualifiedLeads();
  return allLeads.filter(lead => lead.listingCode === listingCode);
}
