const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

admin.initializeApp({ projectId: "real-estate-idealista-bot" });
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

(async () => {
  const ownerOrgId = "org_paco_granados";
  const ref = db.doc(`organizations/${ownerOrgId}/botConfig/config`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`org ${ownerOrgId} botConfig/config does not exist`);
    process.exit(1);
  }
  const data = snap.data() || {};
  const before = data.twilioTemplates || {};
  console.log("Before twilioTemplates keys:", Object.keys(before));

  await ref.set(
    {
      twilioTemplates: {
        callHandoffOrgNoNameEs: "HXd9abc59a90371acbd757d290467ec7e5",
        callHandoffOrgNoNameEn: "HX1c227c0a6db154338f346b7534d2b819",
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const after = (await ref.get()).data().twilioTemplates;
  console.log("After twilioTemplates keys:", Object.keys(after));
  console.log("callHandoffOrgNoNameEs:", after.callHandoffOrgNoNameEs);
  console.log("callHandoffOrgNoNameEn:", after.callHandoffOrgNoNameEn);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
