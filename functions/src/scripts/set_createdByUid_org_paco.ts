import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Run:
// - Ensure GOOGLE_APPLICATION_CREDENTIALS or firebase login
// - npx ts-node functions/src/scripts/set_createdByUid_org_paco.ts

const DATABASE_ID = "realestate-whatsapp-bot";
const ORG_ID = "org_paco_granados";
// If you already know the uid, set it here to skip lookup.
const CREATOR_UID_OVERRIDE = "2tAIQNtxcbP7go4balix4G1WvFd2";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const scopedDb = getFirestore(admin.app(), DATABASE_ID);

async function main() {
  const creatorUid = CREATOR_UID_OVERRIDE.trim()
    ? CREATOR_UID_OVERRIDE.trim()
    : (() => {
        throw new Error("Missing CREATOR_UID_OVERRIDE");
      })();
  console.log(`Resolved creator uid: ${creatorUid}`);

  const listingsRef = scopedDb.collection(`organizations/${ORG_ID}/listings`);
  const listingsSnap = await listingsRef.get();
  console.log(`[${ORG_ID}] listings: ${listingsSnap.docs.length}`);

  const updates = listingsSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.ref);
  const batchSize = 400;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = scopedDb.batch();
    for (const ref of updates.slice(i, i + batchSize)) {
      batch.set(ref, { createdByUid: creatorUid }, { merge: true });
    }
    await batch.commit();
    console.log(`[${ORG_ID}] updated ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

