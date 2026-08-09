import * as admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Marcar un lead como "Contactado" desde la página pública.
 *
 * El agente llama al lead desde su móvil, así que el bot no se entera de nada:
 * sin esto el lead seguiría saliendo en la lista al día siguiente. Al marcarlo
 * desaparece de esta lista para siempre — el seguimiento ya es del agente. El
 * lead no se toca por lo demás: sigue igual en la tabla de Leads.
 */

const DB_NAME = "realestate-whatsapp-bot";

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

export type MarkHandledResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "forbidden" };

function leadRef(orgId: string, leadId: string) {
  return db().collection("organizations").doc(orgId).collection("leads").doc(leadId);
}

/**
 * `agentUid` es el del enlace: si viene, solo puede marcar leads suyos. Sin él
 * (enlace de la agencia) puede marcar cualquiera de la organización.
 *
 * La comprobación se hace aquí y no en el cliente: el enlace es público y lo
 * único que sabemos de quien lo abre es lo que dice su token.
 */
export async function markLeadHandled(params: {
  orgId: string;
  leadId: string;
  agentUid: string;
  nowMs: number;
}): Promise<MarkHandledResult> {
  const ref = leadRef(params.orgId, params.leadId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "not_found" };

  if (params.agentUid) {
    const assigned = snap.data()?.assignedAgentUid;
    if (typeof assigned !== "string" || assigned.trim() !== params.agentUid) {
      return { ok: false, reason: "forbidden" };
    }
  }

  await ref.set(
    {
      inactivityHandledAt: Timestamp.fromMillis(params.nowMs),
      // Para poder responder a "¿por qué dejó de salir este lead?".
      inactivityHandledBy: params.agentUid || "central",
    },
    { merge: true }
  );
  return { ok: true };
}

/** Deshacer el marcado (el botón "Deshacer" justo después de pulsar). */
export async function unmarkLeadHandled(params: {
  orgId: string;
  leadId: string;
  agentUid: string;
}): Promise<MarkHandledResult> {
  const ref = leadRef(params.orgId, params.leadId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "not_found" };

  if (params.agentUid) {
    const assigned = snap.data()?.assignedAgentUid;
    if (typeof assigned !== "string" || assigned.trim() !== params.agentUid) {
      return { ok: false, reason: "forbidden" };
    }
  }

  await ref.set(
    {
      inactivityHandledAt: FieldValue.delete(),
      inactivityHandledBy: FieldValue.delete(),
    },
    { merge: true }
  );
  return { ok: true };
}
