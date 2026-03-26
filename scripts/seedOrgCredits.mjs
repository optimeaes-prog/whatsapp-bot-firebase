#!/usr/bin/env node

/**
 * Script to seed 5000 credits for the org_paco_granados organization.
 * 
 * Usage:
 *   node scripts/seedOrgCredits.mjs
 * 
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS environment variable must be set
 *   - Or run from a GCP environment with appropriate permissions
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
const app = initializeApp({
  projectId: "real-estate-idealista-bot"
});
const db = getFirestore(app, "realestate-whatsapp-bot");

const ORG_ID = "org_paco_granados";
const INITIAL_CREDITS = 5000;

async function seedCredits() {
  console.log(`Setting ${INITIAL_CREDITS} credits for organization: ${ORG_ID}`);

  const orgRef = db.collection("organizations").doc(ORG_ID);
  const orgDoc = await orgRef.get();

  if (!orgDoc.exists) {
    console.error(`Organization ${ORG_ID} does not exist in Firestore!`);
    process.exit(1);
  }

  const currentBalance = orgDoc.data()?.creditBalance || 0;
  console.log(`Current balance: ${currentBalance}`);

  await orgRef.update({
    creditBalance: INITIAL_CREDITS,
    creditBalanceUpdatedAt: new Date(),
  });

  // Log the transaction
  await orgRef.collection("creditTransactions").add({
    type: "purchase",
    amount: INITIAL_CREDITS,
    description: `Saldo inicial: ${INITIAL_CREDITS} créditos`,
    createdAt: new Date(),
  });

  console.log(`✅ Successfully set ${INITIAL_CREDITS} credits for ${ORG_ID}`);
  console.log(`   Previous balance: ${currentBalance}`);
  console.log(`   New balance: ${INITIAL_CREDITS}`);
}

seedCredits().catch((error) => {
  console.error("Error seeding credits:", error);
  process.exit(1);
});
