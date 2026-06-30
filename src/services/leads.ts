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
import type { Lead, LeadFormData, Activity, LeadFollowUpStatus, LeadTask, ProspectNextActionType } from "../types";
import { deleteConversationByChatId } from "./conversations";
import { updateConversation } from "./conversations";
import { auth } from "../lib/firebase";

import { getOrganizationBasePath } from "../lib/organization";
import { deriveNextActionMirror, earliestPendingTask, synthesizeLegacyTasks } from "../lib/tasks";

function getLeadsCollection() {
  return `${getOrganizationBasePath()}/leads`;
}
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

/** Para ordenar: lo más recientemente tocado primero (creación o último mensaje). */
export function leadRecencyMillis(lead: Lead): number {
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
  const snapshot = await getDocs(collection(db, getLeadsCollection()));
  const rows = (snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Lead[]).map(normalizeRecordTasks);
  rows.sort((a, b) => leadRecencyMillis(b) - leadRecencyMillis(a));
  return rows;
}

export async function getLeadsForAgent(agentUid: string): Promise<Lead[]> {
  const uid = agentUid.trim();
  if (!uid) return [];
  const q = query(collection(db, getLeadsCollection()), where("assignedAgentUid", "==", uid));
  const snapshot = await getDocs(q);
  const rows = (snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Lead[]).map(normalizeRecordTasks);
  rows.sort((a, b) => leadRecencyMillis(b) - leadRecencyMillis(a));
  return rows;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const docRef = doc(db, getLeadsCollection(), id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return normalizeRecordTasks({ id: snapshot.id, ...snapshot.data() } as Lead);
}

export async function getLeadByChatId(chatId: string): Promise<Lead | null> {
  const q = query(collection(db, getLeadsCollection()), where("chatId", "==", chatId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return normalizeRecordTasks({ id: doc.id, ...doc.data() } as Lead);
}

export async function getLeadByChatIdForAgent(chatId: string, agentUid: string): Promise<Lead | null> {
  const uid = agentUid.trim();
  if (!uid) return null;
  const q = query(
    collection(db, getLeadsCollection()),
    where("chatId", "==", chatId),
    where("assignedAgentUid", "==", uid)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return normalizeRecordTasks({ id: doc.id, ...doc.data() } as Lead);
}

export async function createLead(data: LeadFormData): Promise<string> {
  const docRef = await addDoc(collection(db, getLeadsCollection()), {
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
    collection(db, getLeadsCollection()),
    where("phone", "==", phone),
    where("listingCode", "==", listingCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`Lead not found for phone ${phone} and listingCode ${listingCode}`);
  }
  const docRef = doc(db, getLeadsCollection(), snapshot.docs[0].id);
  await updateDoc(docRef, { chatId });
}

export async function updateLeadQualificationStatus(
  phone: string,
  listingCode: string,
  qualificationStatus: "not_qualified" | "qualified" | "rejected",
  name?: string
): Promise<void> {
  const q = query(
    collection(db, getLeadsCollection()),
    where("phone", "==", phone),
    where("listingCode", "==", listingCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`Lead not found for phone ${phone} and listingCode ${listingCode}`);
  }
  const docRef = doc(db, getLeadsCollection(), snapshot.docs[0].id);
  const updateData: any = { qualificationStatus };
  if (name) {
    updateData.name = name;
  }
  await updateDoc(docRef, updateData);
}

export async function updateLead(
  id: string,
  data: Partial<Pick<Lead, "notes" | "email" | "tags" | "name" | "listingCode" | "operationType" | "qualificationStatus" | "consent" | "pets" | "income" | "paymentMethod" | "nextActionDate" | "lastContactAt" | "activities" | "tasks" | "followUpStatus" | "assignedAgentUid">>
): Promise<void> {
  const docRef = doc(db, getLeadsCollection(), id);
  const normalized = data.tags ? { ...data, tags: normalizeLeadTags(data.tags) } : data;
  const payload = Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined)
  );
  await updateDoc(docRef, payload);
}

/** Firestore rechaza `undefined`: dejamos solo las claves con valor. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/**
 * Rellena `tasks[]` en leads legados (que solo tienen los escalares nextAction*)
 * para que toda la UI vea siempre la lista de tareas. Solo en lectura; no persiste.
 */
function normalizeRecordTasks(l: Lead): Lead {
  if (l.tasks && l.tasks.length > 0) return l;
  const synth = synthesizeLegacyTasks(l);
  return synth.length > 0 ? { ...l, tasks: synth } : l;
}

/** Da id real a las tareas legadas y limpia `undefined` de cada tarea antes de persistir. */
function cleanTasksForWrite(tasks: LeadTask[]): LeadTask[] {
  return tasks.map((t) => stripUndefined({ ...t, id: t.id === "legacy" ? crypto.randomUUID() : t.id }) as LeadTask);
}

/** Persiste `tasks[]` + recalcula el espejo escalar (nextAction*) desde la tarea pendiente más próxima. */
async function persistLeadTasks(id: string, tasks: LeadTask[]): Promise<void> {
  const finalTasks = cleanTasksForWrite(tasks);
  const mirror = deriveNextActionMirror(finalTasks);
  await updateDoc(doc(db, getLeadsCollection(), id), {
    tasks: finalTasks,
    nextActionDate: mirror.nextActionDate,
    nextActionType: mirror.nextActionType,
    nextActionMessage: mirror.nextActionMessage,
  });
}

/**
 * Registrar un contacto de seguimiento sobre un lead COMPRADOR (llamada, WhatsApp…).
 * Añade la actividad al historial y fija lastContactAt. A diferencia de los propietarios,
 * NO auto-avanza ninguna etapa: el estado del comprador (followUpStatus) se gestiona aparte.
 */
export async function addLeadActivity(
  id: string,
  activity: Omit<Activity, "id" | "at">,
  at?: Date
): Promise<void> {
  const lead = await getLeadById(id);
  if (!lead) throw new Error(`Lead ${id} not found`);
  // `at` = cuándo ocurrió el evento (por defecto ahora).
  const eventTs = at ? Timestamp.fromDate(at) : Timestamp.now();
  const entry = stripUndefined({
    ...activity,
    id: crypto.randomUUID(),
    at: eventTs,
  }) as Activity;
  await updateDoc(doc(db, getLeadsCollection(), id), {
    activities: [...(lead.activities || []), entry],
    lastContactAt: eventTs,
  });
}

/** Añadir una TAREA nueva a un lead comprador. Devuelve el id de la tarea creada. */
export async function addLeadTask(
  id: string,
  task: {
    dueAt: Date;
    type: ProspectNextActionType;
    message?: string | null;
    note?: string | null;
    createdByUid: string;
    createdByName?: string;
  }
): Promise<string> {
  const lead = await getLeadById(id);
  if (!lead) throw new Error(`Lead ${id} not found`);
  const base = synthesizeLegacyTasks(lead);
  const newTask: LeadTask = stripUndefined({
    id: crypto.randomUUID(),
    dueAt: Timestamp.fromDate(task.dueAt),
    type: task.type,
    message: task.message?.trim() || null,
    note: task.note?.trim() || null,
    done: false,
    createdByUid: task.createdByUid,
    createdByName: task.createdByName,
  }) as LeadTask;
  await persistLeadTasks(id, [...base, newTask]);
  return newTask.id;
}

/** Marcar una tarea del lead como hecha (queda en el historial, deja de ser pendiente). */
export async function completeLeadTask(id: string, taskId: string): Promise<void> {
  const lead = await getLeadById(id);
  if (!lead) throw new Error(`Lead ${id} not found`);
  const base = synthesizeLegacyTasks(lead);
  const now = Timestamp.now();
  const next = base.map((t) => (t.id === taskId ? { ...t, done: true, completedAt: now } : t));
  await persistLeadTasks(id, next);
}

/** Editar una tarea pendiente del lead (fecha/tipo/mensaje/nota). */
export async function updateLeadTask(
  id: string,
  taskId: string,
  patch: { dueAt?: Date; type?: ProspectNextActionType; message?: string | null; note?: string | null }
): Promise<void> {
  const lead = await getLeadById(id);
  if (!lead) throw new Error(`Lead ${id} not found`);
  const base = synthesizeLegacyTasks(lead);
  const next = base.map((t) => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      ...(patch.dueAt !== undefined ? { dueAt: Timestamp.fromDate(patch.dueAt) } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.message !== undefined ? { message: patch.message?.trim() || null } : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
    };
  });
  await persistLeadTasks(id, next);
}

/**
 * Fijar (o limpiar) la tarea ACTIVA (la pendiente más próxima) de un lead comprador.
 * Wrapper retro-compatible usado por la ficha del lead: edita la tarea activa, la crea
 * si no hay, o la elimina si `date` es null. Para crear varias tareas, usar `addLeadTask`.
 */
export async function setLeadNextAction(
  id: string,
  date: Date | null,
  nextActionType: ProspectNextActionType | null = null,
  nextActionMessage: string | null = null
): Promise<void> {
  const lead = await getLeadById(id);
  if (!lead) throw new Error(`Lead ${id} not found`);
  const base = synthesizeLegacyTasks(lead);
  const active = earliestPendingTask(base);
  const message = nextActionMessage?.trim() || null;

  let next: LeadTask[];
  if (date == null) {
    next = active ? base.filter((t) => t.id !== active.id) : base;
  } else if (active) {
    next = base.map((t) =>
      t.id === active.id
        ? { ...t, dueAt: Timestamp.fromDate(date), type: nextActionType ?? t.type, message }
        : t
    );
  } else {
    next = [
      ...base,
      stripUndefined({
        id: crypto.randomUUID(),
        dueAt: Timestamp.fromDate(date),
        type: nextActionType ?? "call",
        message,
        done: false,
        createdByUid: "",
      }) as LeadTask,
    ];
  }
  await persistLeadTasks(id, next);
}

/** ¿El lead tiene una próxima acción vencida o para hoy y sigue activo (no cerrado)? */
export function isLeadDueToday(lead: Lead): boolean {
  if (!lead.nextActionDate) return false;
  if (lead.followUpStatus === "cerrado") return false;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return lead.nextActionDate.toMillis() <= end.getTime();
}

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export async function setLeadConsent(params: {
  leadId: string;
  source: "idealista_form" | "agency_website" | "phone_call" | "in_person" | "inbound_whatsapp";
  language: "es" | "en";
  proofUrl?: string;
  capturedAtMs?: number;
}): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Unauthorized");
  }
  const response = await fetch(`${FUNCTIONS_BASE_URL}/setLeadConsent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Error setting consent");
  }
}

export async function deleteLead(id: string): Promise<void> {
  // First, get the lead to obtain the chatId
  const lead = await getLeadById(id);

  // Delete the lead document
  const docRef = doc(db, getLeadsCollection(), id);
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

/** Cambiar el estado de seguimiento de varios leads a la vez. */
export async function bulkUpdateLeadsFollowUpStatus(
  ids: string[],
  followUpStatus: LeadFollowUpStatus,
  concurrency: number = 4
): Promise<void> {
  await parallelLimit(ids, concurrency, async (id) => updateLead(id, { followUpStatus }));
}

/** Reasignar el agente responsable de varios leads a la vez. Pasar cadena vacía para "Sin asignar". */
export async function bulkAssignLeads(
  ids: string[],
  agentUid: string,
  concurrency: number = 4
): Promise<void> {
  await parallelLimit(ids, concurrency, async (id) => updateLead(id, { assignedAgentUid: agentUid }));
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

export async function getQualifiedLeadsByListingCodeForAgent(listingCode: string, agentUid: string): Promise<Lead[]> {
  const all = await getLeadsForAgent(agentUid);
  return filterQualifiedLeads(all).filter((l) => l.listingCode === listingCode);
}
