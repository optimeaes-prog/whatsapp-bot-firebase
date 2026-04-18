import * as admin from "firebase-admin";

// TO RUN THIS: 
// 1. Ensure you have GOOGLE_APPLICATION_CREDENTIALS set or are logged in via firebase CLI
// 2. npx ts-node migrate_to_org.ts

const TARGET_ORG_ID = "org_paco_granados";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
// Note: if using a named database, use admin.firestore().databaseId = DATABASE_ID or similar
// But in multi-tenant setup we usually use the default database or specific ID.
// Based on the code, it uses DATABASE_ID.

async function migrateCollection(sourcePath: string, targetPath: string) {
  console.log(`Migrating from ${sourcePath} to ${targetPath}...`);
  const snapshot = await db.collection(sourcePath).get();
  console.log(`Found ${snapshot.docs.length} documents.`);

  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const targetRef = db.collection(targetPath).doc(doc.id);
    batch.set(targetRef, data, { merge: true });
    count++;

    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`Progress: ${count}...`);
    }
  }

  await batch.commit();
  console.log(`Finished migrating ${count} documents to ${targetPath}.`);
}

async function runMigration() {
  try {
    // 1. Root collections to Org subcollections
    // calls, leads, listings
    await migrateCollection("calls", `organizations/${TARGET_ORG_ID}/calls`);
    await migrateCollection("leads", `organizations/${TARGET_ORG_ID}/leads`);
    await migrateCollection("listings", `organizations/${TARGET_ORG_ID}/listings`);

    // 2. Empty Org ID ("") subcollections to Target Org
    // conversations, ignoredChats
    await migrateCollection("organizations//conversations", `organizations/${TARGET_ORG_ID}/conversations`);
    await migrateCollection("organizations//ignoredChats", `organizations/${TARGET_ORG_ID}/ignoredChats`);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

runMigration();
