import * as admin from "firebase-admin";
import crypto from "crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { normalizeEmail } from "./emailPreferenceToken";

const DB_ID = "realestate-whatsapp-bot";
const COLLECTION = "emailCommunicationPreferences";

function docIdForEmail(email: string): string {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

function db() {
  return getFirestore(admin.app(), DB_ID);
}

export async function getOptionalEmailOptOut(email: string): Promise<boolean> {
  const snap = await db().collection(COLLECTION).doc(docIdForEmail(email)).get();
  if (!snap.exists) return false;
  return snap.data()?.optedOutOfOptionalEmails === true;
}

export async function setOptionalEmailOptOut(email: string, optedOut: boolean): Promise<void> {
  const emailLower = normalizeEmail(email);
  await db().collection(COLLECTION).doc(docIdForEmail(emailLower)).set(
    {
      emailLower,
      optedOutOfOptionalEmails: optedOut,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
