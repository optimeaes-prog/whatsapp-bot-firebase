import * as admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Admin SDK CRUD for `organizations/{orgId}/notificationNumbers/{numberId}`.
 *
 * Rules block client writes that would flip `verified` or change `e164` — all
 * mutation that affects verification state happens here.
 */

const DATABASE_ID = "realestate-whatsapp-bot";
const COLLECTION = "notificationNumbers";

export type NotificationNumberSource =
  | "onboarding"
  | "team_add"
  | "backfill_org_summary"
  | "backfill_botconfig"
  | "backfill_user_agent";

export type NotificationNumberDoc = {
  e164: string;
  phoneDigests: string;
  label?: string;
  verified: boolean;
  verificationSid?: string;
  verificationStatus?: "pending" | "approved" | "canceled" | "expired";
  verificationStartedAt?: Timestamp;
  verificationAttempts?: number;
  verifiedAt?: Timestamp;
  isOrgDefault?: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  source?: NotificationNumberSource;
  legacyOwnerUid?: string;
};

export function notificationNumbersCollection(orgId: string) {
  return getFirestore(admin.app(), DATABASE_ID)
    .collection("organizations")
    .doc(orgId)
    .collection(COLLECTION);
}

/**
 * Normalize a free-text phone string to E.164. Accepts inputs like
 * "+34 612 345 678", "34612345678", "0034 612 345 678".
 *
 * Returns the canonical "+34612345678" form, or null if it can't be normalized.
 * Light validation only: 8–15 digits is the E.164 range. We deliberately don't
 * pull in libphonenumber-js here — Twilio Verify itself rejects malformed
 * numbers, and over-validating at this layer just blocks edge-case formats.
 */
export function normalizeToE164(raw: string | undefined | null): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, "");
  // Strip an international access prefix like "00" if present (only meaningful
  // when the number starts with it AND we don't already have a plus sign).
  if (!trimmed.startsWith("+") && digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function digestsFromE164(e164: string): string {
  return e164.replace(/\D/g, "");
}

export async function findByPhoneDigests(
  orgId: string,
  phoneDigests: string
): Promise<{ id: string; data: NotificationNumberDoc } | null> {
  const snap = await notificationNumbersCollection(orgId)
    .where("phoneDigests", "==", phoneDigests)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() as NotificationNumberDoc };
}

/**
 * Has the org already verified any number? Used to decide whether the just-
 * verified number should become `isOrgDefault: true`.
 */
export async function orgHasVerifiedNumber(orgId: string): Promise<boolean> {
  const snap = await notificationNumbersCollection(orgId)
    .where("verified", "==", true)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Create a pending-verification doc, or reuse an existing one for the same
 * phone digest. Returns the numberId and whether the doc was already verified.
 *
 * Pending state persists across sessions (see plan section B.5) so a user can
 * start verification on desktop and finish it on their phone after the SMS
 * arrives.
 */
export async function upsertPendingNumber(params: {
  orgId: string;
  e164: string;
  label?: string;
  createdBy: string;
  source: NotificationNumberSource;
  verificationSid: string;
}): Promise<{ numberId: string; alreadyVerified: boolean }> {
  const phoneDigests = digestsFromE164(params.e164);
  const db = getFirestore(admin.app(), DATABASE_ID);
  const collection = notificationNumbersCollection(params.orgId);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(
      collection.where("phoneDigests", "==", phoneDigests).limit(1)
    );
    if (!existing.empty) {
      const doc = existing.docs[0];
      const data = doc.data() as NotificationNumberDoc;
      if (data.verified) {
        return { numberId: doc.id, alreadyVerified: true };
      }
      tx.update(doc.ref, {
        verificationSid: params.verificationSid,
        verificationStatus: "pending",
        verificationStartedAt: FieldValue.serverTimestamp(),
        label: params.label ?? data.label ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { numberId: doc.id, alreadyVerified: false };
    }

    const ref = collection.doc();
    const doc: Partial<NotificationNumberDoc> = {
      e164: params.e164,
      phoneDigests,
      label: params.label,
      verified: false,
      verificationSid: params.verificationSid,
      verificationStatus: "pending",
      verificationStartedAt: FieldValue.serverTimestamp() as unknown as Timestamp,
      verificationAttempts: 0,
      createdBy: params.createdBy,
      createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
      updatedAt: FieldValue.serverTimestamp() as unknown as Timestamp,
      source: params.source,
    };
    tx.set(ref, doc);
    return { numberId: ref.id, alreadyVerified: false };
  });
}

/**
 * Mark a number as verified. Idempotent. Sets `isOrgDefault: true` iff this is
 * the first verified number in the org (so the onboarding number becomes the
 * org default automatically).
 */
export async function markVerified(params: {
  orgId: string;
  numberId: string;
}): Promise<void> {
  const db = getFirestore(admin.app(), DATABASE_ID);
  const ref = notificationNumbersCollection(params.orgId).doc(params.numberId);
  const verifiedSnap = await notificationNumbersCollection(params.orgId)
    .where("verified", "==", true)
    .limit(1)
    .get();
  const isFirstVerified = verifiedSnap.empty;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`Notification number ${params.numberId} not found`);
    }
    const data = snap.data() as NotificationNumberDoc;
    if (data.verified) return; // idempotent
    tx.update(ref, {
      verified: true,
      verificationStatus: "approved",
      verifiedAt: FieldValue.serverTimestamp(),
      verificationSid: FieldValue.delete(),
      ...(isFirstVerified ? { isOrgDefault: true } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function incrementVerificationAttempts(params: {
  orgId: string;
  numberId: string;
}): Promise<number> {
  const ref = notificationNumbersCollection(params.orgId).doc(params.numberId);
  const db = getFirestore(admin.app(), DATABASE_ID);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 0;
    const data = snap.data() as NotificationNumberDoc;
    const next = (data.verificationAttempts || 0) + 1;
    tx.update(ref, {
      verificationAttempts: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return next;
  });
}

export async function deleteNumber(params: {
  orgId: string;
  numberId: string;
}): Promise<void> {
  await notificationNumbersCollection(params.orgId).doc(params.numberId).delete();
}

export async function getNumber(
  orgId: string,
  numberId: string
): Promise<NotificationNumberDoc | null> {
  const snap = await notificationNumbersCollection(orgId).doc(numberId).get();
  if (!snap.exists) return null;
  return snap.data() as NotificationNumberDoc;
}
