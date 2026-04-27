import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

import { sendWelcomeNotification } from "./emailService";

/**
 * Logic to send a welcome email via SendGrid
 */
export async function sendWelcomeEmail(email: string, displayName: string): Promise<void> {
  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  const orgId = userSnap.empty ? "" : userSnap.docs[0].data().orgId;
  
  let orgName = "Proplead";
  if (orgId) {
    const orgSnap = await db.collection("organizations").doc(orgId).get();
    if (orgSnap.exists) {
      orgName = orgSnap.data()?.name || "Proplead";
    }
  }

  await sendWelcomeNotification(email, displayName, orgName);
}

