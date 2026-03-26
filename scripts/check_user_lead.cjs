const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const DATABASE_ID = "realestate-whatsapp-bot";
const db = getFirestore(admin.app(), DATABASE_ID);

async function findLead(phone) {
  const snaps = await db.collection("organizations/org_paco_granados/leads")
    .where("phone", "==", phone)
    .get();

  if (snaps.empty) {
    console.log(`No lead found for phone ${phone}`);
    return;
  }

  snaps.forEach(doc => {
    console.log(`Found lead: ${doc.id}`, doc.data());
  });
}

const phone = "+34669354177";
// Also try without +
findLead(phone).then(() => findLead("34669354177")).catch(console.error);
