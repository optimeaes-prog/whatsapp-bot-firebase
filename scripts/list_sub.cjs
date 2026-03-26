const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const db = admin.firestore();

async function listSub() {
  const collections = await db.doc("organizations/org_paco_granados").listCollections();
  console.log("Found collections under org_paco_granados:");
  for (const col of collections) {
    console.log("- ", col.id);
  }
}

listSub().catch(console.error);
