import type { Firestore } from "firebase-admin/firestore";
import type { BotConfig, ListingRow } from "../types";
import { getListingAgentScopeUid } from "./firestore";

/** Result of the listing-scoped resolution path, surfaced for monitoring. */
export type RecipientResolutionMode = "listing" | "legacy_fallback" | "empty";

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

/**
 * Resolve recipients from a listing's `notificationNumberIds`. Reads each
 * referenced doc under `organizations/{orgId}/notificationNumbers/{id}` and
 * returns the `e164` values of those that are `verified: true`, in input order.
 *
 * Returns `null` if the listing has no IDs configured (i.e. legacy listing).
 * Returns an empty array if all referenced docs are missing or unverified —
 * caller chooses whether to fall back to legacy or send to nobody.
 */
export async function resolveRecipientsFromListing(params: {
  db: Firestore;
  orgId: string;
  listing: Pick<ListingRow, "notificationNumberIds"> | null;
}): Promise<string[] | null> {
  const ids = params.listing?.notificationNumberIds;
  if (!Array.isArray(ids) || ids.length === 0) return null;

  const collection = params.db
    .collection("organizations")
    .doc(params.orgId)
    .collection("notificationNumbers");

  const out: string[] = [];
  for (const rawId of ids) {
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!id) continue;
    const snap = await collection.doc(id).get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    if (data.verified !== true) continue;
    const e164 = typeof data.e164 === "string" ? data.e164.trim() : "";
    if (e164) out.push(e164);
  }
  return out;
}

export type ResolveRecipientsResult = {
  recipients: string[];
  mode: RecipientResolutionMode;
};

export async function resolveQualifiedLeadNotificationRecipients(params: {
  orgId: string;
  botConfig: Pick<BotConfig, "notificationNumbers">;
  envNotificationFallback: string;
  listing: ListingRow | null;
  leadAssignedAgentUid?: string;
  db: Firestore;
}): Promise<string[]> {
  const result = await resolveQualifiedLeadNotificationRecipientsWithMode(params);
  return result.recipients;
}

/**
 * Same as the legacy entrypoint above but also reports which path produced the
 * recipients. Use this when you want to log/alert on listings that still need
 * to be backfilled (mode === "legacy_fallback").
 */
export async function resolveQualifiedLeadNotificationRecipientsWithMode(params: {
  orgId: string;
  botConfig: Pick<BotConfig, "notificationNumbers">;
  envNotificationFallback: string;
  listing: ListingRow | null;
  leadAssignedAgentUid?: string;
  db: Firestore;
}): Promise<ResolveRecipientsResult> {
  const fromListing = await resolveRecipientsFromListing({
    db: params.db,
    orgId: params.orgId,
    listing: params.listing,
  });
  if (fromListing !== null && fromListing.length > 0) {
    return { recipients: fromListing, mode: "listing" };
  }

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
  const merged = mergeOrgAndAgentRecipients(orgNums, agentNums);

  if (params.listing && Array.isArray(params.listing.notificationNumberIds) && params.listing.notificationNumberIds.length > 0) {
    // Listing had IDs but none resolved to a verified number — surface this so
    // we can monitor stale references rather than silently sending nowhere.
    console.warn(
      "legacy_recipient_resolution: listing.notificationNumberIds present but no verified numbers found",
      { orgId: params.orgId, listingCode: (params.listing as { listingCode?: string }).listingCode }
    );
  } else if (params.listing) {
    // Pre-backfill listing — expected during the rollout window.
    console.warn("legacy_recipient_resolution: listing missing notificationNumberIds, used legacy merge", {
      orgId: params.orgId,
      listingCode: (params.listing as { listingCode?: string }).listingCode,
    });
  }

  return { recipients: merged, mode: merged.length > 0 ? "legacy_fallback" : "empty" };
}
