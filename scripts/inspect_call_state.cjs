const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

admin.initializeApp({ projectId: "real-estate-idealista-bot" });
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

const chatId = process.argv[2] || "34638625339@s.whatsapp.net";

(async () => {
  for (const orgId of ["u7knHl2U48I7NnateEZE", "org_paco_granados"]) {
    console.log(`\n===== ORG ${orgId} =====`);

    const convoSnap = await db
      .collection(`organizations/${orgId}/conversations`)
      .where("chatId", "==", chatId)
      .get();
    if (convoSnap.empty) {
      console.log("conversations: NONE");
    } else {
      for (const d of convoSnap.docs) {
        const x = d.data();
        console.log(`conv ${d.id}:`, {
          listingCode: x.listingCode,
          flowStep: x.flowStep,
          isFinished: x.isFinished,
          tags: x.tags,
          name: x.name,
          language: x.language,
          languageLockSource: x.languageLockSource,
          handoff: x.handoff,
          pendingNameConfirmation: x.pendingNameConfirmation,
          historyLen: Array.isArray(x.history) ? x.history.length : 0,
          lastFew: Array.isArray(x.history) ? x.history.slice(-5).map(h => ({ r: h.role, t: (h.text||"").slice(0,80) })) : null,
        });
      }
    }

    const leadSnap = await db
      .collection(`organizations/${orgId}/leads`)
      .where("chatId", "==", chatId)
      .get();
    if (leadSnap.empty) {
      const phoneSnap = await db
        .collection(`organizations/${orgId}/leads`)
        .where("phone", "==", "34638625339")
        .get();
      if (phoneSnap.empty) {
        console.log("leads: NONE");
      } else {
        for (const d of phoneSnap.docs) {
          const x = d.data();
          console.log(`lead-by-phone ${d.id}:`, {
            phone: x.phone,
            chatId: x.chatId,
            listingCode: x.listingCode,
            tags: x.tags,
            name: x.name,
            consent: x.consent ? Object.keys(x.consent) : null,
            leadSource: x.leadSource,
            listingResolutionStatus: x.listingResolutionStatus,
          });
        }
      }
    } else {
      for (const d of leadSnap.docs) {
        const x = d.data();
        console.log(`lead ${d.id}:`, {
          phone: x.phone,
          chatId: x.chatId,
          listingCode: x.listingCode,
          tags: x.tags,
          name: x.name,
          consent: x.consent ? Object.keys(x.consent) : null,
          leadSource: x.leadSource,
          listingResolutionStatus: x.listingResolutionStatus,
        });
      }
    }
  }

  console.log("\n===== INDEXES =====");
  const phoneNumberId_intake = "748828678308050";
  // List a few ids from phoneNumberIndex/wabaIndex
  const phoneIdx = await db.collection("phoneNumberIndex").limit(10).get();
  console.log("phoneNumberIndex (first 10):");
  for (const d of phoneIdx.docs) console.log(`  ${d.id} -> ${JSON.stringify(d.data())}`);
  const wabaIdx = await db.collection("wabaIndex").limit(10).get();
  console.log("wabaIndex (first 10):");
  for (const d of wabaIdx.docs) console.log(`  ${d.id} -> ${JSON.stringify(d.data())}`);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
