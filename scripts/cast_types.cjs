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
const workingDb = getFirestore(admin.app(), DATABASE_ID);
const orgDb = workingDb.collection("organizations").doc("org_paco_granados");

async function main() {
  const leadsSnapshot = await orgDb.collection("leads").get();
  console.log(`Analyzing ${leadsSnapshot.size} leads to cast types...`);

  let processed = 0;
  let updated = 0;
  for (const doc of leadsSnapshot.docs) {
    const lead = doc.data();
    const updatePayload = {};

    if (typeof lead.pets === 'string') {
        const p = lead.pets.toLowerCase();
        if (p.includes("sí") || p.includes("si") || p.includes("un perro") || p.includes("un gato") || p.includes("true")) {
            updatePayload.pets = true;
        } else if (p.includes("no") || p.includes("sin") || p.includes("false")) {
            updatePayload.pets = false;
        } else {
            updatePayload.pets = admin.firestore.FieldValue.delete();
        }
    }

    if (typeof lead.income === 'string') {
        const num = parseFloat(lead.income.replace(/[^\d.-]/g, ""));
        if (!isNaN(num)) {
            updatePayload.income = num;
        } else {
            updatePayload.income = admin.firestore.FieldValue.delete();
        }
    }

    if (typeof lead.paymentMethod === 'string') {
        const pm = lead.paymentMethod.toLowerCase();
        if (pm.includes("contado") || pm.includes("efectivo") || pm.includes("sin hipoteca")) {
            updatePayload.paymentMethod = "Contado";
        } else if (pm.includes("hipoteca") || pm.includes("préstamo") || pm.includes("prestam")) {
            updatePayload.paymentMethod = "Hipoteca";
        } else {
            updatePayload.paymentMethod = admin.firestore.FieldValue.delete();
        }
    }

    if (Object.keys(updatePayload).length > 0) {
        await orgDb.collection("leads").doc(doc.id).update(updatePayload);
        updated++;
    }
    processed++;
    if (processed % 100 === 0) console.log(`${processed} leads checked`);
  }
  console.log(`Done. Updated ${updated} records.`);
}

main().then(() => {
  console.log("Finished script.");
  process.exit(0);
}).catch(console.error);
