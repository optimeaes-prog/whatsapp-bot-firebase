/**
 * Remove legacy `name` field from every document in `organizations`.
 *
 * The app now uses `agencyName` for display (emails, invitation preview, etc.).
 *
 * Usage (from functions/ directory):
 *   node scripts/remove-organization-name-field.js --project-id=real-estate-idealista-bot --database-id=realestate-whatsapp-bot
 *
 * Apply deletes:
 *   node scripts/remove-organization-name-field.js --project-id=real-estate-idealista-bot --database-id=realestate-whatsapp-bot --commit
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

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: DATABASE_ID });

const BATCH_SIZE = 450;

async function main() {
  console.log(`\n=== Remove organizations.name (dry-run=${!COMMIT}) ===`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}\n`);

  const snapshot = await db.collection("organizations").get();
  const toUpdate = snapshot.docs.filter((d) => Object.prototype.hasOwnProperty.call(d.data() || {}, "name"));

  console.log(`Scanned ${snapshot.size} org docs; ${toUpdate.length} have a top-level "name" field.\n`);

  for (const d of toUpdate) {
    const v = d.get("name");
    console.log(`- ${d.id}: name=${JSON.stringify(v)}`);
  }

  if (!COMMIT) {
    console.log("\nDry run only. Pass --commit to delete the field.\n");
    return;
  }

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.update(d.ref, { name: admin.firestore.FieldValue.delete() });
    }
    await batch.commit();
    console.log(`Committed batch ${i / BATCH_SIZE + 1} (${chunk.length} updates)`);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
