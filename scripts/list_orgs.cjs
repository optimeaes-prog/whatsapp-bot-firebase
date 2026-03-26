const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const db = admin.firestore();

async function listCollections() {
  const orgs = await db.collection("organizations").listDocuments();
  console.log("Found organizations:");
  for (const doc of orgs) {
    console.log("- ", doc.id);
  }
}

listCollections().catch(console.error);
