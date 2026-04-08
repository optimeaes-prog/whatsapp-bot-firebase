/**
 * Removes "lead" tag from historical leads and conversations.
 *
 * Usage:
 *   node scripts/remove_lead_tag_from_historic_data.cjs
 *
 * Optional env:
 *   ORG_ID=org_paco_granados
 */
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const dotenv = require("dotenv");
const { resolve } = require("path");

dotenv.config({ path: resolve(__dirname, "../functions/.env") });

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot",
  });
}

const DATABASE_ID = "realestate-whatsapp-bot";
const ORG_ID = process.env.ORG_ID || "org_paco_granados";
const db = getFirestore(admin.app(), DATABASE_ID);

function cleanTags(tags) {
  if (!Array.isArray(tags)) return null;
  const filtered = tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean)
    .filter((t) => t.toLowerCase() !== "lead");
  return Array.from(new Set(filtered));
}

async function cleanCollection(orgRef, collectionName) {
  const snap = await orgRef.collection(collectionName).get();
  let scanned = 0;
  let updated = 0;
  let batch = db.batch();
  let batchOps = 0;

  for (const row of snap.docs) {
    scanned++;
    const data = row.data();
    if (!Array.isArray(data.tags)) continue;

    const nextTags = cleanTags(data.tags);
    const before = JSON.stringify(data.tags);
    const after = JSON.stringify(nextTags);
    if (before === after) continue;

    batch.update(row.ref, { tags: nextTags });
    batchOps++;
    updated++;

    if (batchOps >= 400) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  console.log(`${collectionName}: scanned ${scanned}, updated ${updated}`);
  return { scanned, updated };
}

async function main() {
  const orgRef = db.collection("organizations").doc(ORG_ID);
  console.log(`Cleaning org: ${ORG_ID}`);

  const leadsResult = await cleanCollection(orgRef, "leads");
  const conversationsResult = await cleanCollection(orgRef, "conversations");

  console.log("Done.");
  console.log({
    leads: leadsResult,
    conversations: conversationsResult,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
