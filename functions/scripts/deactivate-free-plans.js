/**
 * Script: Deactivate Free plans that were auto-assigned on signup.
 *
 * What it does:
 * - For every org with `plan == "free"`, removes that field (and `planActivatedAt` if present).
 * - Optionally resets `creditBalance` to 0 ONLY when it looks like free-only balance:
 *   - no Stripe customer/subscription on org
 *   - current creditBalance <= 40
 *
 * Usage (from functions/ directory):
 *   node scripts/deactivate-free-plans.js --project-id=real-estate-idealista-bot --database-id=realestate-whatsapp-bot --commit
 *
 * Dry-run (default, no writes):
 *   node scripts/deactivate-free-plans.js --project-id=real-estate-idealista-bot --database-id=realestate-whatsapp-bot
 */

const admin = require("firebase-admin");

function parseArg(name) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a === `--${name}` || a.startsWith(prefix));
  if (!raw) return undefined;
  if (raw === `--${name}`) return true;
  return raw.slice(prefix.length);
}

const PROJECT_ID = parseArg("project-id") || process.env.PROJECT_ID || "real-estate-idealista-bot";
const DATABASE_ID = parseArg("database-id") || process.env.DATABASE_ID || "realestate-whatsapp-bot";
const COMMIT = Boolean(parseArg("commit"));

const FREE_CREDITS = 40;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: DATABASE_ID });

function hasStripeFields(orgData) {
  const stripeCustomerId = typeof orgData?.stripeCustomerId === "string" ? orgData.stripeCustomerId : "";
  const subStripeId =
    typeof orgData?.subscription?.stripeSubscriptionId === "string" ? orgData.subscription.stripeSubscriptionId : "";
  return Boolean(stripeCustomerId || subStripeId);
}

async function main() {
  console.log(`\n=== Deactivate Free plans (dry-run=${!COMMIT}) ===`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}\n`);

  const snapshot = await db.collection("organizations").where("plan", "==", "free").get();
  console.log(`Found ${snapshot.size} organizations with plan="free"`);

  let updatedPlanCount = 0;
  let resetBalanceCount = 0;
  let skippedStripeCount = 0;

  let batch = db.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const orgId = doc.id;
    const creditBalance = typeof data.creditBalance === "number" ? data.creditBalance : 0;

    const hasStripe = hasStripeFields(data);
    if (hasStripe) skippedStripeCount += 1;

    const shouldResetBalance = !hasStripe && creditBalance > 0 && creditBalance <= FREE_CREDITS;

    console.log(
      `- ${orgId}: creditBalance=${creditBalance}, hasStripe=${hasStripe}, resetBalance=${shouldResetBalance}`
    );

    if (!COMMIT) continue;

    const update = {
      plan: admin.firestore.FieldValue.delete(),
      planActivatedAt: admin.firestore.FieldValue.delete(),
    };

    if (shouldResetBalance) {
      update.creditBalance = 0;
      update.creditBalanceUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    batch.set(doc.ref, update, { merge: true });
    updatedPlanCount += 1;
    if (shouldResetBalance) resetBalanceCount += 1;

    batchOps += 1;
    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (COMMIT && batchOps > 0) {
    await batch.commit();
  }

  console.log("\n=== Summary ===");
  console.log(`plan removed: ${updatedPlanCount}${COMMIT ? "" : " (dry-run)"}`);
  console.log(`creditBalance reset: ${resetBalanceCount}${COMMIT ? "" : " (dry-run)"}`);
  console.log(`orgs with Stripe fields (still plan removed): ${skippedStripeCount}`);
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err?.message || err);
  process.exit(1);
});

