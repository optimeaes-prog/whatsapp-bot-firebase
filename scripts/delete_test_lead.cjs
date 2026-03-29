const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const dotenv = require("dotenv");
const { resolve } = require("path");

dotenv.config({ path: resolve(__dirname, "../functions/.env") });

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const DATABASE_ID = "realestate-whatsapp-bot";
const db = getFirestore(admin.app(), DATABASE_ID);

async function deleteLead() {
  const phone1 = "+34669354177";
  const phone2 = "34669354177";

  // delete leads
  const leadsRef = db.collection("organizations/org_paco_granados/leads");
  
  const docs1 = await leadsRef.where("phone", "==", phone1).get();
  for (const doc of docs1.docs) {
    console.log("Deleting lead", doc.id);
    await doc.ref.delete();
  }
  
  const docs2 = await leadsRef.where("phone", "==", phone2).get();
  for (const doc of docs2.docs) {
    console.log("Deleting lead", doc.id);
    await doc.ref.delete();
  }

  // delete conversations
  const convsRef = db.collection("organizations/org_paco_granados/conversations");
  
  const cvs1 = await convsRef.where("phone", "==", phone1).get();
  for (const doc of cvs1.docs) {
    console.log("Deleting conversation", doc.id);
    await doc.ref.delete();
  }
  
  const cvs2 = await convsRef.where("phone", "==", phone2).get();
  for (const doc of cvs2.docs) {
    console.log("Deleting conversation", doc.id);
    await doc.ref.delete();
  }

  console.log("Deleted test data");
}
deleteLead().catch(console.error).finally(() => process.exit(0));
