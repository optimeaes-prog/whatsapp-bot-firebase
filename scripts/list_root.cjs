const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const db = admin.firestore();

async function listRoot() {
  const collections = await db.listCollections();
  console.log("Root collections:");
  for (const col of collections) {
    console.log("- ", col.id);
  }
}

listRoot().catch(console.error);
