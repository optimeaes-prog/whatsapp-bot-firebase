/**
 * Script: Assign PLUS plan + 2000 extra conversations to org_paco_granados
 * - Sets subscription with a manual ID so getOrgSubscription() doesn't return null
 * - Resets creditBalance to exactly 2080 (80 base + 2000 extra)
 *
 * Usage (from functions/ directory):
 *   node scripts/assign-plus-plan.js
 */

const admin = require("firebase-admin");

const PROJECT_ID = "real-estate-idealista-bot";
const DATABASE_ID = "realestate-whatsapp-bot";
const ORG_ID = "org_paco_granados";

const PLAN_ID = "plus";
const BASE_CREDITS = 80;
const EXTRA_BLOCKS = 48;           // 48 × 40 = 1920 extra conversations
const EXTRA_CONVERSATIONS = EXTRA_BLOCKS * 40; // 1920
const FINAL_BALANCE = BASE_CREDITS + EXTRA_CONVERSATIONS; // 2000

// Monthly subscription: period ends 30 days from now
const now = new Date();
const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

admin.initializeApp({ projectId: PROJECT_ID });

const db = admin.firestore();
db.settings({ databaseId: DATABASE_ID });

async function main() {
  console.log(`\n=== Assigning PLUS plan to ${ORG_ID} ===`);
  console.log(`  Final creditBalance: ${FINAL_BALANCE}`);
  console.log(`  Period end: ${periodEnd.toISOString()}\n`);

  const orgRef = db.collection("organizations").doc(ORG_ID);

  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new Error(`Organization ${ORG_ID} does not exist.`);
  }

  const previousBalance = orgSnap.data()?.creditBalance || 0;
  console.log(`  Previous creditBalance: ${previousBalance}`);

  // 1. Set subscription (include a manual stripeSubscriptionId so the API
  //    doesn't fall back to "free" — getOrgSubscription checks for this field)
  await orgRef.set(
    {
      subscription: {
        planId: PLAN_ID,
        status: "active",
        stripeSubscriptionId: "manual_plus_paco_granados",
        stripeCustomerId: "manual_paco_granados",
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        extraBlocks: EXTRA_BLOCKS,
      },
    },
    { merge: true }
  );
  console.log(`✓ Subscription: planId="${PLAN_ID}", status="active", extraBlocks=${EXTRA_BLOCKS} (${EXTRA_CONVERSATIONS} extra convs)`);

  // 2. Hard-set creditBalance to exactly FINAL_BALANCE (removes previous credits)
  await orgRef.set(
    {
      creditBalance: FINAL_BALANCE,
      creditBalanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`✓ creditBalance set to ${FINAL_BALANCE} (was ${previousBalance})`);

  // 3. Log the adjustment transaction
  const diff = FINAL_BALANCE - previousBalance;
  await orgRef.collection("creditTransactions").add({
    type: diff >= 0 ? "purchase" : "deduction",
    amount: diff,
    description: `Ajuste manual: Plan ${PLAN_ID.toUpperCase()} (Base ${BASE_CREDITS} + ${EXTRA_BLOCKS} packs × 40 = ${EXTRA_CONVERSATIONS} extra). Balance anterior: ${previousBalance} → ${FINAL_BALANCE}`,
    createdAt: admin.firestore.Timestamp.now(),
  });
  console.log(`✓ Transaction logged (diff: ${diff >= 0 ? "+" : ""}${diff})`);

  console.log(`\n✅ Done. org_paco_granados → PLUS plan, ${FINAL_BALANCE} credits.`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
