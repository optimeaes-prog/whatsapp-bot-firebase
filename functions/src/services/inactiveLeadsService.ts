import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

/**
 * Shared "cold lead" query: sales leads that were never qualified and haven't
 * said anything in over 48h. Used both by the public page endpoint (live list)
 * and by the daily reminder job, so both always agree on who is cold.
 */

const DB_NAME = "realestate-whatsapp-bot";

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

/**
 * Ventana de "lead frío": lleva más de 48h sin responder, pero menos de 14 días.
 *
 * El límite inferior es el mismo que usa la columna "Inactivo" de la tabla de
 * Leads. El superior existe porque un lead que lleva dos meses callado ya no se
 * recupera: sin él la lista solo crece y el recordatorio diario se vuelve ruido.
 * Además hace que la lista se limpie sola, sin tener que archivar nada a mano.
 */
export const INACTIVITY_MIN_MS = 48 * 60 * 60 * 1000;
export const INACTIVITY_MAX_MS = 14 * 24 * 60 * 60 * 1000;

/** Safety cap so one huge org can't blow up a request or the daily job. */
const MAX_LEADS_SCANNED = 1000;

/**
 * Cuántos mensajes del final de la conversación se devuelven. Son para que el
 * agente vea por dónde se quedó la cosa antes de llamar, no para leer el hilo
 * entero: con los últimos cambios de turno basta y el payload no se dispara.
 */
const RECENT_MESSAGES = 6;

/** Un mensaje muy largo se recorta: en la tarjeta no cabe igualmente. */
const MAX_MESSAGE_CHARS = 400;

export type RecentMessage = {
  /** "user" es el lead; "assistant" somos nosotros. */
  role: "user" | "assistant";
  text: string;
  atMs: number;
};

export type InactiveLead = {
  id: string;
  name: string;
  phone: string;
  /** Listing description — shown as "Identificador Anuncio" in the Leads table. */
  listingDescription: string;
  /**
   * Código del anuncio. Puede ser "__pending__": leads que entran por llamada
   * antes de asignarles un inmueble. La tabla de Leads los muestra como "Pend.".
   */
  listingCode: string;
  lastMessageAtMs: number;
  /** When we last told the agency about this lead, if ever. */
  inactivityNotifiedAtMs: number | null;
  /**
   * Agente al que pertenece el lead. Se sincroniza desde el anuncio, y es el
   * mismo campo por el que filtra la tabla de Leads cuando entra un agente.
   * Vacío = sin asignar.
   */
  assignedAgentUid: string;
  /** Documento de conversación (el id del doc es el chatId). */
  chatId: string;
  /** Mensajes totales del hilo, como la columna "Mensajes" de la tabla de Leads. */
  messageCount: number;
  /** Los últimos mensajes, en orden cronológico. */
  recentMessages: RecentMessage[];
};

/**
 * Leads of an org that are Venta + not qualified + inside the inactivity window,
 * newest first. Computed at call time — nothing is cached.
 *
 * Two rules worth spelling out because they mirror the Leads table:
 * - A lead with no `qualificationStatus` counts as "not qualified" (that's how
 *   the UI filter treats it), otherwise we'd skip the oldest leads.
 * - The operation type comes from the listing when we can find it, falling back
 *   to the lead's own field, same as the frontend join.
 */
export async function listInactiveSalesLeads(
  orgId: string,
  nowMs: number,
  opts?: {
    /** Si viene, solo los leads de ese agente (enlace personal de un agente). */
    agentUid?: string;
  }
): Promise<InactiveLead[]> {
  const quietSince = Timestamp.fromMillis(nowMs - INACTIVITY_MIN_MS);
  const tooOldBefore = Timestamp.fromMillis(nowMs - INACTIVITY_MAX_MS);
  const orgRef = db().collection("organizations").doc(orgId);

  // Leads without `lastMessageDate` are excluded by the query itself — we don't
  // know when they last wrote, so we can't call them cold.
  const leadsSnap = await orgRef
    .collection("leads")
    .where("lastMessageDate", "<", quietSince)
    .where("lastMessageDate", ">", tooOldBefore)
    .orderBy("lastMessageDate", "desc")
    .limit(MAX_LEADS_SCANNED)
    .get();

  if (leadsSnap.empty) return [];

  const listingsSnap = await orgRef.collection("listings").get();
  const listingsByCode = new Map<string, { description: string; operationType: string }>();
  for (const doc of listingsSnap.docs) {
    const data = doc.data();
    const code = typeof data.listingCode === "string" ? data.listingCode.trim() : "";
    if (!code) continue;
    listingsByCode.set(code, {
      description: typeof data.description === "string" ? data.description : "",
      operationType: typeof data.operationType === "string" ? data.operationType : "",
    });
  }

  const wantedAgentUid = (opts?.agentUid || "").trim();

  const rows: InactiveLead[] = [];
  for (const doc of leadsSnap.docs) {
    const lead = doc.data();

    const qualificationStatus = lead.qualificationStatus || "not_qualified";
    if (qualificationStatus !== "not_qualified") continue;

    const assignedAgentUid =
      typeof lead.assignedAgentUid === "string" ? lead.assignedAgentUid.trim() : "";
    if (wantedAgentUid && assignedAgentUid !== wantedAgentUid) continue;

    const listingCode = typeof lead.listingCode === "string" ? lead.listingCode.trim() : "";
    const listing = listingCode ? listingsByCode.get(listingCode) : undefined;
    const operationType = listing?.operationType || lead.operationType || "";
    if (operationType !== "Venta") continue;

    const lastMessageAtMs = lead.lastMessageDate?.toMillis?.();
    if (!lastMessageAtMs) continue;

    rows.push({
      id: doc.id,
      name: typeof lead.name === "string" ? lead.name : "",
      phone: typeof lead.phone === "string" ? lead.phone : "",
      listingDescription: listing?.description || "",
      listingCode,
      lastMessageAtMs,
      inactivityNotifiedAtMs: lead.inactivityNotifiedAt?.toMillis?.() ?? null,
      assignedAgentUid,
      chatId: typeof lead.chatId === "string" ? lead.chatId : "",
      messageCount: 0,
      recentMessages: [],
    });
  }

  await attachConversations(orgRef, rows);
  return rows;
}

/**
 * Nombre de cada agente, para poder decir de quién es cada lead en la lista
 * completa. Mismo orden de preferencia que la pantalla de Organización.
 *
 * Solo hace falta para el enlace de la agencia: en el de un agente todas las
 * filas serían suyas y repetir su nombre no aporta nada.
 */
export async function resolveAgentNames(
  orgId: string,
  agentUids: string[]
): Promise<Map<string, string>> {
  const uids = [...new Set(agentUids.filter(Boolean))];
  const names = new Map<string, string>();
  if (uids.length === 0) return names;

  const snaps = await db().getAll(...uids.map((uid) => db().collection("users").doc(uid)));
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() || {};
    // Un usuario de otra organización no se nombra aquí: sería filtrar quién
    // trabaja en otra agencia a quien abra este enlace.
    if (data.orgId !== orgId) continue;
    const name = [data.name, data.displayName, data.email].find(
      (v) => typeof v === "string" && v.trim()
    );
    if (name) names.set(snap.id, String(name).trim());
  }
  return names;
}

/**
 * Añade el recuento de mensajes y el final de la conversación a cada lead.
 *
 * Pide solo los documentos que hacen falta (el id del doc de conversación es el
 * chatId) en vez de leer la colección entera: una agencia puede tener miles de
 * conversaciones y aquí como mucho hay unas decenas de leads.
 */
async function attachConversations(
  orgRef: FirebaseFirestore.DocumentReference,
  rows: InactiveLead[]
): Promise<void> {
  const byChatId = new Map<string, InactiveLead[]>();
  for (const row of rows) {
    if (!row.chatId) continue;
    const list = byChatId.get(row.chatId);
    if (list) list.push(row);
    else byChatId.set(row.chatId, [row]);
  }
  if (byChatId.size === 0) return;

  const refs = [...byChatId.keys()].map((chatId) => orgRef.collection("conversations").doc(chatId));
  const snaps = await db().getAll(...refs);

  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const history = Array.isArray(data.history) ? data.history : [];
    const recent = history
      .slice(-RECENT_MESSAGES)
      .map((item: { role?: unknown; text?: unknown; timestamp?: unknown }): RecentMessage => ({
        role: item.role === "assistant" ? "assistant" : "user",
        text: typeof item.text === "string" ? item.text.slice(0, MAX_MESSAGE_CHARS) : "",
        atMs: typeof item.timestamp === "number" ? item.timestamp : 0,
      }))
      .filter((m: RecentMessage) => m.text.length > 0);

    const messageCount = typeof data.messageCount === "number" ? data.messageCount : history.length;

    for (const row of byChatId.get(snap.id) || []) {
      row.messageCount = messageCount;
      row.recentMessages = recent;
    }
  }
}
