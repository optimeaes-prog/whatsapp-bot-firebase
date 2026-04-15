const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const DATABASE_ID = "realestate-whatsapp-bot";
const db = getFirestore(admin.app(), DATABASE_ID);

async function checkUser() {
  console.log(`Checking 'users' collection in database: ${DATABASE_ID}`);
  const snapshot = await db.collection("users").get();
  snapshot.forEach(doc => {
    console.log(`- Email: ${doc.data().email}, OrgId: ${doc.data().orgId}`);
  });
}

checkUser().catch(console.error);
