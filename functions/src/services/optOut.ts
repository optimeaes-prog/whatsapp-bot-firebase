import { ignoreChat, isChatIgnored } from "./firestore";
import { normalizeToCanonicalChatId } from "../utils";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { recordSystemAction } from "./auditService";
import { sendTextMessage } from "./messagingProvider";

/**
 * Opt-out keywords. WhatsApp Business Messaging Policy requires us to honor
 * consumer-initiated opt-outs. We match the most common Spanish / English
 * variants used by Meta-endorsed STOP flows. Case-insensitive, whole message only.
 */
// "cancelar" intentionally excluded: it collides with visit-scheduling replies
// ("cancelar esa hora", "cancelar") during qualification. Meta's policy requires
// at least one recognizable opt-out keyword, not all of them — STOP/BAJA/UNSUBSCRIBE
// plus the explicit phrases below are unambiguous in the real-estate context.
const OPT_OUT_REGEX = /^\s*(stop|baja|unsubscribe|dar de baja|no (me )?escribas|no mas mensajes)\s*\.?\s*$/i;

const OPT_OUT_CONFIRMATION_ES =
  "Has dejado de recibir mensajes de este número. No te volveremos a contactar salvo que nos escribas tú primero.";

export function isOptOutMessage(text: string | undefined | null): boolean {
  if (!text) return false;
  return OPT_OUT_REGEX.test(text);
}

/**
 * Mark a chat as opted-out: writes ignoredChats/{canonical} and sends a one-time
 * confirmation reply (within the 24h window — free-form allowed). Idempotent:
 * second call is a no-op on the confirmation reply.
 */
export async function applyOptOut(params: {
  orgId: string;
  chatId: string;
  phone: string;
}): Promise<void> {
  const canonical = normalizeToCanonicalChatId(params.chatId);
  const already = await isChatIgnored(canonical);
  await ignoreChat(canonical);
  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  await db.doc(`organizations/${params.orgId}/conversations/${canonical}`).set(
    { optedOut: true },
    { merge: true }
  );
  await recordSystemAction("conversation", canonical, "opt_out_captured", {
    phone: params.phone,
    source: "keyword",
  });
  if (!already) {
    try {
      await sendTextMessage({ to: params.phone, body: OPT_OUT_CONFIRMATION_ES, chatId: canonical });
    } catch (err) {
      console.warn("applyOptOut: could not send confirmation reply:", (err as Error)?.message || err);
    }
  }
}
