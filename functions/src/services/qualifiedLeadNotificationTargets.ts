import type { Firestore } from "firebase-admin/firestore";
import type { BotConfig, ListingRow } from "../types";
import { getListingAgentScopeUid } from "./firestore";

/** Firestore field on users/{uid}; comma-separated WhatsApp destinations for qualified-lead summaries (non-members). */
export const QUALIFIED_LEAD_NOTIFICATION_NUMBERS_FIELD = "qualifiedLeadNotificationNumbers";

/**
 * Digits-only fingerprint for deduping "346123..." vs "+34 612 345 ...".
 */
export function normalizePhoneForDedupe(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || digits;
}

export function splitNotificationNumberRaw(raw: string | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Same composition as legacy onLeadWritten: botConfig first, then env param string as fallback for the combined raw field.
 */
export function resolveOrgNotificationNumbers(config: Pick<BotConfig, "notificationNumbers">, envFallback: string): string[] {
  const notificationNumberRaw = config.notificationNumbers || envFallback;
  return splitNotificationNumberRaw(notificationNumberRaw);
}

export function resolveAssignedAgentUid(params: {
  listing: ListingRow | null;
  leadAssignedAgentUid?: string;
}): string {
  if (params.listing) {
    return getListingAgentScopeUid(params.listing);
  }
  const fromLead = typeof params.leadAssignedAgentUid === "string" ? params.leadAssignedAgentUid.trim() : "";
  return fromLead;
}

async function fetchAgentNotificationNumbers(params: {
  db: Firestore;
  orgId: string;
  assignedUid: string;
}): Promise<string[]> {
  const uid = params.assignedUid.trim();
  if (!uid) return [];

  const snap = await params.db.collection("users").doc(uid).get();
  if (!snap.exists) return [];

  const data = snap.data() || {};
  if (typeof data.orgId !== "string" || data.orgId !== params.orgId) return [];

  const role = typeof data.role === "string" ? data.role : "";
  if (role === "member") return [];

  const raw = data[QUALIFIED_LEAD_NOTIFICATION_NUMBERS_FIELD];
  if (typeof raw !== "string" || !raw.trim()) return [];

  return splitNotificationNumberRaw(raw);
}

/**
 * Org numbers always receive qualified-lead notifications; assigned agent numbers are added when distinct after normalization.
 * Order: org first, then agent-only extras (stable for logging).
 */
export function mergeOrgAndAgentRecipients(orgNums: string[], agentNums: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const pushUnique = (display: string) => {
    const key = normalizePhoneForDedupe(display);
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(display);
  };

  for (const n of orgNums) pushUnique(n);
  for (const n of agentNums) pushUnique(n);

  return out;
}

export async function resolveQualifiedLeadNotificationRecipients(params: {
  orgId: string;
  botConfig: Pick<BotConfig, "notificationNumbers">;
  envNotificationFallback: string;
  listing: ListingRow | null;
  leadAssignedAgentUid?: string;
  db: Firestore;
}): Promise<string[]> {
  const orgNums = resolveOrgNotificationNumbers(params.botConfig, params.envNotificationFallback);
  const uid = resolveAssignedAgentUid({
    listing: params.listing,
    leadAssignedAgentUid: params.leadAssignedAgentUid,
  });
  const agentNums = uid
    ? await fetchAgentNotificationNumbers({
        db: params.db,
        orgId: params.orgId,
        assignedUid: uid,
      })
    : [];
  return mergeOrgAndAgentRecipients(orgNums, agentNums);
}
