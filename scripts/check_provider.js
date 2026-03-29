const admin = require("firebase-admin");
const serviceAccount = require("../functions/service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "real-estate-idealista-bot",
  });
}

const db = admin.firestore();
async function main() {
  const doc = await db.doc("organizations/org_paco_granados/botConfig/config").get();
  console.log("Config:", doc.exists ? doc.data() : "No config");
}
main().catch(console.error).finally(() => process.exit(0));
