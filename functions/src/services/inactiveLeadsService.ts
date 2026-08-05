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

/** Same threshold the Leads table uses for its "+48H" column. */
export const INACTIVITY_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** Safety cap so one huge org can't blow up a request or the daily job. */
const MAX_LEADS_SCANNED = 1000;

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
};

/**
 * Leads of an org that are Venta + not qualified + silent for >48h, newest
 * first. Computed at call time — nothing is cached.
 *
 * Two rules worth spelling out because they mirror the Leads table:
 * - A lead with no `qualificationStatus` counts as "not qualified" (that's how
 *   the UI filter treats it), otherwise we'd skip the oldest leads.
 * - The operation type comes from the listing when we can find it, falling back
 *   to the lead's own field, same as the frontend join.
 */
export async function listInactiveSalesLeads(orgId: string, nowMs: number): Promise<InactiveLead[]> {
  const cutoff = Timestamp.fromMillis(nowMs - INACTIVITY_THRESHOLD_MS);
  const orgRef = db().collection("organizations").doc(orgId);

  // Leads without `lastMessageDate` are excluded by the query itself — we don't
  // know when they last wrote, so we can't call them cold.
  const leadsSnap = await orgRef
    .collection("leads")
    .where("lastMessageDate", "<", cutoff)
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

  const rows: InactiveLead[] = [];
  for (const doc of leadsSnap.docs) {
    const lead = doc.data();

    const qualificationStatus = lead.qualificationStatus || "not_qualified";
    if (qualificationStatus !== "not_qualified") continue;

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
    });
  }

  return rows;
}
