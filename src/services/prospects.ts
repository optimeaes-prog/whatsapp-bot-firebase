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
import type {
  Prospect,
  ProspectFormData,
  ProspectStage,
  ProspectActivity,
  ProspectActivityOutcome,
} from "../types";
import { getOrganizationId, getOrganizationBasePath } from "../lib/organization";
import { normalizePhoneForMatch } from "../lib/utils";

function getProspectsCollection() {
  return `${getOrganizationBasePath()}/prospects`;
}

/** Firestore rechaza `undefined`: dejamos solo las claves con valor. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Para ordenar: lo más recientemente tocado primero. */
function prospectRecencyMillis(p: Prospect): number {
  const updated = p.updatedAt?.toMillis?.() ?? 0;
  const created = p.createdAt?.toMillis?.() ?? 0;
  return Math.max(updated, created);
}

/**
 * Al registrar un contacto, el resultado mueve la tarjeta de etapa
 * automáticamente (el agente siempre puede cambiarla a mano después).
 */
const OUTCOME_TO_STAGE: Partial<Record<ProspectActivityOutcome, ProspectStage>> = {
  no_answer: "ilocalizable",
  wrong_number: "ilocalizable",
  phone_off: "ilocalizable",
  callback: "seguimiento",
  stalled: "seguimiento",
  appointment_set: "citado",
  docs_pending: "negociacion",
  won: "ganado",
  not_interested: "descartado",
  has_tenant: "descartado",
  // other: sin cambio de etapa
};

export async function getProspects(): Promise<Prospect[]> {
  const snapshot = await getDocs(collection(db, getProspectsCollection()));
  const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Prospect[];
  rows.sort((a, b) => prospectRecencyMillis(b) - prospectRecencyMillis(a));
  return rows;
}

/**
 * Para agentes: unión de los que tienen asignados y los que han creado.
 * Mismo patrón que getListingsForAgent (dos queries, dedupe por id).
 */
export async function getProspectsForAgent(uid: string): Promise<Prospect[]> {
  const agentUid = uid.trim();
  if (!agentUid) return [];

  const colRef = collection(db, getProspectsCollection());
  const [assignedRes, createdRes] = await Promise.allSettled([
    getDocs(query(colRef, where("assignedAgentUid", "==", agentUid))),
    getDocs(query(colRef, where("createdByUid", "==", agentUid))),
  ]);

  if (assignedRes.status === "rejected") {
    console.error("[Prospects] agent query (assignedAgentUid) failed", assignedRes.reason);
  }
  if (createdRes.status === "rejected") {
    console.error("[Prospects] agent query (createdByUid) failed", createdRes.reason);
  }

  const byId = new Map<string, Prospect>();
  for (const res of [assignedRes, createdRes]) {
    if (res.status !== "fulfilled") continue;
    for (const d of res.value.docs) {
      byId.set(d.id, { id: d.id, ...d.data() } as Prospect);
    }
  }

  const rows = Array.from(byId.values());
  rows.sort((a, b) => prospectRecencyMillis(b) - prospectRecencyMillis(a));
  return rows;
}

export async function getProspectById(id: string): Promise<Prospect | null> {
  const snapshot = await getDoc(doc(db, getProspectsCollection(), id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Prospect;
}

export async function createProspect(
  data: ProspectFormData & { createdByUid: string }
): Promise<string> {
  const now = Timestamp.now();
  const payload = stripUndefined({
    ...data,
    orgId: getOrganizationId(),
    stage: data.stage || "por_llamar",
    operationType: data.operationType || "Venta",
    // Siempre presentes (default "") para que las reglas de Firestore puedan
    // comparar propiedad/asignación sin acceder a campos inexistentes.
    createdByUid: data.createdByUid || "",
    assignedAgentUid: data.assignedAgentUid ?? "",
    activities: [],
    createdAt: now,
    updatedAt: now,
  });
  const docRef = await addDoc(collection(db, getProspectsCollection()), payload);
  return docRef.id;
}

export async function updateProspect(id: string, data: Partial<Prospect>): Promise<void> {
  const docRef = doc(db, getProspectsCollection(), id);
  const payload = stripUndefined({ ...data, updatedAt: Timestamp.now() });
  await updateDoc(docRef, payload);
}

/** Mover la tarjeta de etapa (Kanban / selector). */
export async function updateProspectStage(id: string, stage: ProspectStage): Promise<void> {
  await updateDoc(doc(db, getProspectsCollection(), id), {
    stage,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Registrar un contacto (llamada, WhatsApp, visita…). Añade la actividad al
 * historial, fija `lastContactAt` y auto-avanza la etapa según el resultado.
 */
export async function addProspectActivity(
  id: string,
  activity: Omit<ProspectActivity, "id" | "at">
): Promise<void> {
  const prospect = await getProspectById(id);
  if (!prospect) throw new Error(`Prospect ${id} not found`);

  const now = Timestamp.now();
  const entry: ProspectActivity = stripUndefined({
    ...activity,
    id: crypto.randomUUID(),
    at: now,
  }) as ProspectActivity;

  const nextStage = OUTCOME_TO_STAGE[activity.outcome];
  await updateDoc(doc(db, getProspectsCollection(), id), {
    activities: [...(prospect.activities || []), entry],
    lastContactAt: now,
    ...(nextStage ? { stage: nextStage } : {}),
    updatedAt: now,
  });
}

/** Fijar (o limpiar) la fecha/hora de próxima acción + el recordatorio (minutos antes). */
export async function setProspectNextAction(
  id: string,
  date: Date | null,
  reminderMinutes: number | null = null
): Promise<void> {
  await updateDoc(doc(db, getProspectsCollection(), id), {
    nextActionDate: date ? Timestamp.fromDate(date) : null,
    reminderMinutesBefore: date && reminderMinutes != null ? reminderMinutes : null,
    reminderSentAt: null, // cambiar la próxima acción reactiva el recordatorio
    updatedAt: Timestamp.now(),
  });
}

export async function deleteProspect(id: string): Promise<void> {
  await deleteDoc(doc(db, getProspectsCollection(), id));
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

export async function deleteProspects(ids: string[], concurrency = 4): Promise<void> {
  await parallelLimit(ids, concurrency, async (id) => deleteProspect(id));
}

/**
 * Busca captaciones existentes que coincidan por teléfono (normalizado) o email, para
 * avisar de posibles duplicados al crear una nueva. Filtra en memoria porque el teléfono
 * se guarda sin normalizar y los volúmenes por organización son pequeños (mismo supuesto
 * que getProspects). Si se pasa `agentUid`, solo mira las captaciones de ese agente.
 */
export async function findCaptacionByPhoneOrEmail(
  opts: { phone?: string; email?: string; agentUid?: string }
): Promise<Prospect[]> {
  const phoneKey = normalizePhoneForMatch(opts.phone);
  const emailKey = (opts.email || "").trim().toLowerCase();
  if (!phoneKey && !emailKey) return [];

  const all = opts.agentUid ? await getProspectsForAgent(opts.agentUid) : await getProspects();
  return all.filter((p) => {
    const phoneMatch = !!phoneKey && normalizePhoneForMatch(p.phone) === phoneKey;
    const emailMatch = !!emailKey && (p.email || "").trim().toLowerCase() === emailKey;
    return phoneMatch || emailMatch;
  });
}

/**
 * Enlaza una captación con el anuncio publicado desde ella (back-ref `wonListingId`).
 * No cambia la etapa automáticamente: que el agente decida si la marca como "ganado".
 */
export async function linkProspectToListing(prospectId: string, listingId: string): Promise<void> {
  await updateDoc(doc(db, getProspectsCollection(), prospectId), {
    wonListingId: listingId,
    updatedAt: Timestamp.now(),
  });
}

// --- Selectores puros (UI + futuro widget de Dashboard) ---------------------

/** ¿Tiene una próxima acción vencida o para hoy y sigue en el pipeline activo? */
export function isDueToday(p: Prospect): boolean {
  if (!p.nextActionDate) return false;
  if (p.stage === "ganado" || p.stage === "descartado") return false;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return p.nextActionDate.toMillis() <= end.getTime();
}

/** Agrupa los prospectos por etapa (para el tablero Kanban). */
export function prospectsByStage(list: Prospect[]): Record<ProspectStage, Prospect[]> {
  const groups = {
    por_llamar: [],
    ilocalizable: [],
    seguimiento: [],
    citado: [],
    negociacion: [],
    ganado: [],
    descartado: [],
  } as Record<ProspectStage, Prospect[]>;
  for (const p of list) {
    (groups[p.stage] || (groups[p.stage] = [])).push(p);
  }
  return groups;
}
