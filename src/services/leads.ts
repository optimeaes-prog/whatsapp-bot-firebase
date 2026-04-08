import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Lead, LeadFormData } from "../types";
import { deleteConversationByChatId } from "./conversations";
import { updateConversation } from "./conversations";

import { getOrganizationBasePath } from "../lib/organization";

const COLLECTION_NAME = `${getOrganizationBasePath()}/leads`;
const LEADS_TAG_BLOCKLIST = new Set(["lead"]);

function normalizeLeadTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !LEADS_TAG_BLOCKLIST.has(t.toLowerCase()))
    )
  );
}

function leadRecencyMillis(lead: Lead): number {
  const created = lead.createdAt && typeof (lead.createdAt as { toMillis?: () => number }).toMillis === "function"
    ? (lead.createdAt as { toMillis: () => number }).toMillis()
    : 0;
  const last = lead.lastMessageDate && typeof (lead.lastMessageDate as { toMillis?: () => number }).toMillis === "function"
    ? (lead.lastMessageDate as { toMillis: () => number }).toMillis()
    : 0;
  return Math.max(created, last);
}

export async function getLeads(): Promise<Lead[]> {
  // Do not orderBy("createdAt") only: pipeline leads are upserted via updateLeadChatInfo and historically
  // omitted createdAt; Firestore excludes those docs from orderBy(createdAt) queries.
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const rows = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Lead[];
  rows.sort((a, b) => leadRecencyMillis(b) - leadRecencyMillis(a));
  return rows;
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
  data: Partial<Pick<Lead, "notes" | "tags" | "name" | "listingCode" | "operationType" | "qualificationStatus">>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const payload = data.tags ? { ...data, tags: normalizeLeadTags(data.tags) } : data;
  await updateDoc(docRef, payload);
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

async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function deleteLeads(ids: string[], concurrency: number = 4): Promise<void> {
  await parallelLimit(ids, concurrency, async (id) => deleteLead(id));
}

function qualificationStatusToConversationQualified(
  status: "not_qualified" | "qualified" | "rejected" | "no_response"
): boolean | null {
  if (status === "qualified") return true;
  if (status === "rejected") return false;
  return null;
}

export async function bulkUpdateLeadsQualificationStatus(
  ids: string[],
  qualificationStatus: "not_qualified" | "qualified" | "rejected" | "no_response",
  concurrency: number = 4
): Promise<void> {
  await parallelLimit(ids, concurrency, async (id) => {
    const lead = await getLeadById(id);
    if (!lead) return;

    await updateLead(id, { qualificationStatus });

    if (lead.chatId) {
      await updateConversation(lead.chatId, {
        qualified: qualificationStatusToConversationQualified(qualificationStatus),
      });
    }
  });
}

export async function bulkAddLeadTags(
  ids: string[],
  tagsToAdd: string[],
  concurrency: number = 4
): Promise<void> {
  const normalized = normalizeLeadTags(tagsToAdd);
  if (normalized.length === 0) return;

  await parallelLimit(ids, concurrency, async (id) => {
    const lead = await getLeadById(id);
    if (!lead) return;

    const nextTags = normalizeLeadTags([...(lead.tags || []), ...normalized]);
    await updateLead(id, { tags: nextTags });

    if (lead.chatId) {
      await updateConversation(lead.chatId, { tags: nextTags });
    }
  });
}

export async function bulkRemoveLeadTag(
  ids: string[],
  tagToRemove: string,
  concurrency: number = 4
): Promise<void> {
  const normalized = tagToRemove.trim();
  if (!normalized) return;

  await parallelLimit(ids, concurrency, async (id) => {
    const lead = await getLeadById(id);
    if (!lead) return;

    const nextTags = (lead.tags || []).filter((t) => t !== normalized);
    await updateLead(id, { tags: nextTags });

    if (lead.chatId) {
      await updateConversation(lead.chatId, { tags: nextTags });
    }
  });
}

export async function bulkUpdateLeadsListingCode(
  ids: string[],
  listingCode: string,
  concurrency: number = 4
): Promise<void> {
  const normalized = listingCode.trim();
  if (!normalized) return;

  await parallelLimit(ids, concurrency, async (id) => {
    const lead = await getLeadById(id);
    if (!lead) return;

    await updateLead(id, { listingCode: normalized });
    if (lead.chatId) {
      await updateConversation(lead.chatId, { listingCode: normalized });
    }
  });
}

export function isQualifiedLead(lead: Lead): boolean {
  return lead.qualificationStatus === "qualified";
}

export function filterQualifiedLeads(leads: Lead[]): Lead[] {
  return leads.filter(isQualifiedLead);
}

/**
 * Timestamp for analytics (e.g. dashboard date range): approximate qualification moment.
 * Cloud Functions set lastMessageDate when qualifying; older rows may only have createdAt.
 */
export function qualifiedLeadMetricTimestamp(lead: Lead): Timestamp | undefined {
  return lead.lastMessageDate ?? lead.createdAt;
}

export async function getQualifiedLeadsByListingCode(listingCode: string): Promise<Lead[]> {
  const all = await getLeads();
  return filterQualifiedLeads(all).filter((l) => l.listingCode === listingCode);
}
