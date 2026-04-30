const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

admin.initializeApp({ projectId: "real-estate-idealista-bot" });
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

const chatId = process.argv[2];
const orgId = process.argv[3] || "u7knHl2U48I7NnateEZE";
if (!chatId) {
  console.error("usage: node reset_call_state.cjs <chatId> [orgId]");
  process.exit(1);
}

(async () => {
  const convoRef = db.doc(`organizations/${orgId}/conversations/${chatId}`);
  const before = (await convoRef.get()).data();
  console.log("BEFORE:", JSON.stringify({
    flowStep: before?.flowStep,
    listingCode: before?.listingCode,
    tags: before?.tags,
    language: before?.language,
    isFinished: before?.isFinished,
    historyLen: Array.isArray(before?.history) ? before.history.length : 0,
  }, null, 2));

  await convoRef.set(
    {
      flowStep: "call_listing_collect",
      listingCode: "__pending__",
      tags: ["lead", "call", "pending-listing"],
      isFinished: false,
      language: "es",
      pendingListingCandidate: FieldValue.delete(),
      pendingListingQueue: FieldValue.delete(),
      pendingListingQueueIndex: FieldValue.delete(),
      pendingListingCandidates: FieldValue.delete(),
      rejectedListingCodes: FieldValue.delete(),
      listingResolveAttempts: FieldValue.delete(),
      pendingNameConfirmation: FieldValue.delete(),
      handoff: FieldValue.delete(),
      history: [],
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const phone = chatId.replace(/[^0-9]/g, "");
  const leadsSnap = await db
    .collection(`organizations/${orgId}/leads`)
    .where("chatId", "==", chatId)
    .get();
  for (const d of leadsSnap.docs) {
    await d.ref.set(
      {
        listingCode: "__pending__",
        listingResolutionStatus: "pending",
        tags: ["lead", "call", "pending-listing"],
        leadSource: "call",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("Reset lead", d.id);
  }
  if (leadsSnap.empty) {
    const phoneLeadsSnap = await db
      .collection(`organizations/${orgId}/leads`)
      .where("phone", "==", phone)
      .get();
    for (const d of phoneLeadsSnap.docs) {
      await d.ref.set(
        {
          chatId,
          listingCode: "__pending__",
          listingResolutionStatus: "pending",
          tags: ["lead", "call", "pending-listing"],
          leadSource: "call",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("Reset lead-by-phone", d.id);
    }
  }

  const after = (await convoRef.get()).data();
  console.log("AFTER:", JSON.stringify({
    flowStep: after?.flowStep,
    listingCode: after?.listingCode,
    tags: after?.tags,
    language: after?.language,
    isFinished: after?.isFinished,
    historyLen: Array.isArray(after?.history) ? after.history.length : 0,
  }, null, 2));

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
