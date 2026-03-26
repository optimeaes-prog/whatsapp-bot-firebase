const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const db = admin.firestore();

async function checkConfig() {
  const snaps = await db.collection("organizations/org_paco_granados/botConfig").get();
  console.log("Documents in botConfig:");
  snaps.forEach(doc => console.log("- ", doc.id, doc.data()));
}

checkConfig().catch(console.error);
