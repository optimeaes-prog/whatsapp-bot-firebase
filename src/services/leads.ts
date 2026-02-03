import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Lead, LeadFormData } from "../types";
import { deleteConversationByChatId } from "./conversations";

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
    phone: data.phone,
    listingCode: data.listingCode,
    chatId: data.chatId,
    operationType: data.operationType,
    name: data.name,
    qualificationStatus: data.qualificationStatus,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateLeadChatInfo(
  phone: string,
  listingCode: string,
  chatId: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("phone", "==", phone),
    where("listingCode", "==", listingCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`Lead not found for phone ${phone} and listingCode ${listingCode}`);
  }
  const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
  await updateDoc(docRef, { chatId });
}

export async function updateLeadQualificationStatus(
  phone: string,
  listingCode: string,
  qualificationStatus: "not_qualified" | "qualified" | "rejected",
  name?: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("phone", "==", phone),
    where("listingCode", "==", listingCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`Lead not found for phone ${phone} and listingCode ${listingCode}`);
  }
  const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
  const updateData: any = { qualificationStatus };
  if (name) {
    updateData.name = name;
  }
  await updateDoc(docRef, updateData);
}

export async function updateLead(
  id: string,
  data: Partial<Pick<Lead, "notes" | "tags" | "name">>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, data);
}

export async function deleteLead(id: string): Promise<void> {
  // First, get the lead to obtain the chatId
  const lead = await getLeadById(id);

  // Delete the lead document
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);

  // Delete the associated conversation if the lead exists and has a chatId
  if (lead && lead.chatId) {
    await deleteConversationByChatId(lead.chatId);
  }
}
