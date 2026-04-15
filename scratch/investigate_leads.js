
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

async function investigate() {
  console.log("Investigating Alicia, Maria, Loles...");
  
  const leadsGroup = db.collectionGroup("leads");
  const snapshot = await leadsGroup.where("name", "in", ["Alicia", "Maria", "Loles"]).get();
  
  if (snapshot.empty) {
    console.log("Leads not found by name.");
    return;
  }
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`Lead: ${data.name} (ID: ${doc.id})`);
    console.log(`  Path: ${doc.ref.path}`);
    console.log(`  OrgId: ${doc.ref.path.split("/")[1]}`);
    console.log(`  Phone: ${data.phone}`);
    console.log(`  Listing: ${data.listingCode}`);
    console.log(`  ChatId: ${data.chatId}`);
    
    if (data.chatId) {
      const convRef = db.doc(`organizations/${doc.ref.path.split("/")[1]}/conversations/${data.chatId}`);
      const convSnap = await convRef.get();
      if (convSnap.exists()) {
        console.log(`  Conversation: Found`);
        console.log(`  - history length: ${convSnap.data().history?.length || 0}`);
        console.log(`  - flowStep: ${convSnap.data().flowStep}`);
      } else {
        console.log(`  Conversation: NOT FOUND in org ${doc.ref.path.split("/")[1]}`);
      }
    }
  }
}

investigate();
