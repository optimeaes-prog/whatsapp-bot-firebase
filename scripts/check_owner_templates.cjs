const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
admin.initializeApp({ projectId: "real-estate-idealista-bot" });
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
(async () => {
  for (const orgId of ["org_paco_granados", "u7knHl2U48I7NnateEZE"]) {
    const snap = await db.doc(`organizations/${orgId}/botConfig/config`).get();
    const data = snap.data() || {};
    console.log("=== ORG:", orgId, "exists:", snap.exists, "===");
    console.log("orgName:", data.orgName);
    console.log("assistantAvatarName:", data.assistantAvatarName);
    console.log("cloudApiConfig.assistantAvatarName:", data.cloudApiConfig?.assistantAvatarName);
    console.log("twilioTemplates:", JSON.stringify(data.twilioTemplates || {}, null, 2));
    console.log("cloudApiConfig.templates:", JSON.stringify(data.cloudApiConfig?.templates || {}, null, 2));
    console.log("");
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
