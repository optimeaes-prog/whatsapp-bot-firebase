/**
 * Borra todos los documentos en organizations/{ORG_ID}/calls (histórico de informes de llamada).
 * Requiere credenciales de aplicación (p. ej. gcloud auth application-default login o functions/.env).
 *
 *   node scripts/delete_org_calls.cjs
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
const ORG_ID = "org_paco_granados";
const db = getFirestore(admin.app(), DATABASE_ID);

async function main() {
  const ref = db.collection("organizations").doc(ORG_ID).collection("calls");
  let deleted = 0;
  for (;;) {
    const snap = await ref.limit(500).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
    console.log(`Deleted ${snap.size} docs (total ${deleted})`);
  }
  console.log(`Done. Removed ${deleted} call document(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
