import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { FUNCTIONS_BASE_URL } from "../lib/api";
import { getOrganizationId } from "../lib/organization";
import type { NotificationNumber } from "../types";

/**
 * Client-side service for verified notification numbers.
 *
 * Reads come direct from Firestore (rules permit any org member to read).
 * Mutations (start/check verification, delete) go through Cloud Functions so
 * that flipping `verified: true` stays gated by Twilio Verify on the server.
 */

const COLLECTION = "notificationNumbers";

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");
  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  return fetch(`${FUNCTIONS_BASE_URL}${path}`, { ...init, headers });
}

function mapDoc(snapshot: QueryDocumentSnapshot<DocumentData>): NotificationNumber {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    e164: typeof data.e164 === "string" ? data.e164 : "",
    phoneDigests: typeof data.phoneDigests === "string" ? data.phoneDigests : "",
    label: typeof data.label === "string" ? data.label : undefined,
    verified: data.verified === true,
    verificationStatus: data.verificationStatus,
    verifiedAt: data.verifiedAt as Timestamp | undefined,
    isOrgDefault: data.isOrgDefault === true,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
    source: data.source,
    legacyOwnerUid: typeof data.legacyOwnerUid === "string" ? data.legacyOwnerUid : undefined,
  };
}

function collectionRef() {
  const orgId = getOrganizationId();
  return collection(db, "organizations", orgId, COLLECTION);
}

export async function listNotificationNumbers(): Promise<NotificationNumber[]> {
  // No `orderBy("createdAt")` here because pending docs may have a serverTimestamp
  // that hasn't materialised yet — sort client-side on the materialised millis.
  const snap = await getDocs(query(collectionRef(), orderBy("createdAt", "asc")));
  return snap.docs.map(mapDoc);
}

export async function getVerifiedNotificationNumbers(): Promise<NotificationNumber[]> {
  const snap = await getDocs(query(collectionRef(), where("verified", "==", true)));
  return snap.docs.map(mapDoc);
}

export async function getNotificationNumberById(id: string): Promise<NotificationNumber | null> {
  const ref = doc(collectionRef(), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapDoc(snap as unknown as QueryDocumentSnapshot<DocumentData>);
}

export async function updateNotificationNumberLabel(id: string, label: string): Promise<void> {
  const ref = doc(collectionRef(), id);
  await updateDoc(ref, {
    label: label.trim().slice(0, 60) || null,
    updatedAt: new Date(),
  });
}

/**
 * Mark a different number as the org default. Firestore rules allow managers
 * to toggle `isOrgDefault`. Clears the flag on the previous default in the
 * same call so the org always has at most one default.
 */
export async function setOrgDefaultNotificationNumber(id: string): Promise<void> {
  const all = await listNotificationNumbers();
  const current = all.find((n) => n.isOrgDefault);
  const ref = doc(collectionRef(), id);
  await updateDoc(ref, { isOrgDefault: true, updatedAt: new Date() });
  if (current && current.id !== id) {
    await updateDoc(doc(collectionRef(), current.id), { isOrgDefault: false, updatedAt: new Date() });
  }
}

export type StartVerificationResult = {
  numberId: string;
  alreadyVerified: boolean;
  e164: string;
};

export async function startVerification(params: {
  phone: string;
  label?: string;
  source?: "onboarding" | "team_add";
}): Promise<StartVerificationResult> {
  const response = await authedFetch("/startNotificationNumberVerification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: params.phone,
      label: params.label,
      source: params.source ?? "team_add",
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
  return (await response.json()) as StartVerificationResult;
}

export type CheckVerificationResult = {
  verified: boolean;
  status: string;
  attemptsRemaining?: number;
};

export async function checkVerification(params: {
  numberId: string;
  code: string;
}): Promise<CheckVerificationResult> {
  const response = await authedFetch("/checkNotificationNumberVerification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
  return (await response.json()) as CheckVerificationResult;
}

/**
 * Delete a notification number. The functions endpoint centralises this so we
 * can add audit later. Firestore rules also allow managers to delete directly
 * — both paths are valid.
 */
export async function deleteNotificationNumber(id: string): Promise<void> {
  const response = await authedFetch("/deleteNotificationNumber", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numberId: id }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
}

/** Fallback for managers — bypasses the function and hits Firestore directly. */
export async function deleteNotificationNumberDirect(id: string): Promise<void> {
  await deleteDoc(doc(collectionRef(), id));
}
