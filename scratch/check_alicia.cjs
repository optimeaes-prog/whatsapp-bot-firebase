
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

async function checkAliciaStatus() {
  const userEmail = "ejperezreyes@gmail.com";
  const userSnap = await db.collection("users").where("email", "==", userEmail).get();
  const orgId = userSnap.docs[0].data().orgId;
  
  const phone = "34652559865";
  console.log(`Checking conversation for Alicia (${phone}) in org ${orgId}...`);
  
  const convSnap = await db.collection("organizations").doc(orgId).collection("conversations").doc(phone).get();
  
  if (!convSnap.exists()) {
    console.log("Conversation document NO ENCONTRADO en la organización del usuario.");
    // Search globally
    const globalSnap = await db.collectionGroup("conversations").where("phone", "==", phone).get();
    if (globalSnap.empty) {
      console.log("No se encontró conversación por teléfono globalmente.");
    } else {
      console.log(`Encontrado globalmente en: ${globalSnap.docs[0].ref.path}`);
    }
    return;
  }
  
  const conv = convSnap.data();
  console.log(`FlowStep: ${conv.flowStep}`);
  console.log(`History length: ${conv.history ? conv.history.length : 0}`);
  console.log(`Error Details: ${conv.errorDetails || "Ninguno"}`);
}

checkAliciaStatus();
