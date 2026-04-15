import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

import { defineSecret } from "firebase-functions/params";

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

/**
 * Trigger that runs when a new user is created in Firebase Auth.
 * 1. Provisions a new Organization document
 * 2. Links the user to the organization with role "owner"
 * 3. Sends a Welcome Email
 * 4. Alerts the admin
 */
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

/**
 * Trigger that runs when a new user is created in Firebase Auth.
 */
export const onUserCreated = functions
  .runWith({ secrets: [SENDGRID_API_KEY] })
  .auth.user()
  .onCreate(async (user) => {
    const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

    // 1. Create the new organization
    const orgRef = db.collection("organizations").doc();
    const orgId = orgRef.id;

    await orgRef.set({
      onboardingCompleted: false,
      onboardingStep: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      plan: "free",
      creditBalance: 40,
    });

    // 2. Map the user to the organization
    const displayName = user.displayName || "Nuevo Usuario";
    await db.collection("users").doc(user.uid).set({
      email: user.email,
      name: displayName,
      role: "owner",
      orgId: orgId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Send Welcome Email
    if (user.email) {
      try {
        await sendWelcomeEmail(user.email, displayName);
      } catch (error) {
        console.error("Failed to send welcome email during signup:", error);
      }
    }
  });
