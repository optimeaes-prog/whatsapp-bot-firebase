const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const db = admin.firestore();

async function checkDoc() {
  const doc = await db.doc("organizations/org_paco_granados").get();
  console.log("org_paco_granados data:", doc.data());
}

checkDoc().catch(console.error);
