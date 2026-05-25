import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Run:
// - Ensure GOOGLE_APPLICATION_CREDENTIALS or firebase login
// - npx ts-node functions/src/scripts/backfill_agent_scope.ts

const DATABASE_ID = "realestate-whatsapp-bot";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const scopedDb = getFirestore(admin.app(), DATABASE_ID);

type OrgListingDoc = {
  createdByUid?: unknown;
  assignedAgentUid?: unknown;
  assignedAgentName?: unknown;
  agentName?: unknown;
};

type OrgLeadDoc = {
  listingCode?: unknown;
  assignedAgentUid?: unknown;
};

type OrgConversationDoc = {
  listingCode?: unknown;
  assignedAgentUid?: unknown;
};

async function backfillOrg(orgId: string) {
  const listingsRef = scopedDb.collection(`organizations/${orgId}/listings`);
  const leadsRef = scopedDb.collection(`organizations/${orgId}/leads`);
  const conversationsRef = scopedDb.collection(`organizations/${orgId}/conversations`);

  const listingsSnap = await listingsRef.get();

  const listingByCode = new Map<string, { agentScopeUid?: string }>();
  const listingUpdates: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];

  for (const doc of listingsSnap.docs) {
    const data = doc.data() as OrgListingDoc;
    const createdByUid = typeof data.createdByUid === "string" ? data.createdByUid.trim() : "";
    const assignedAgentUid = typeof data.assignedAgentUid === "string" ? data.assignedAgentUid.trim() : "";
    const agentScopeUid = assignedAgentUid || createdByUid;

    // Cache by listingCode if present
    const listingCode = typeof (doc.data() as any).listingCode === "string" ? (doc.data() as any).listingCode.trim() : "";
    if (listingCode) {
      listingByCode.set(listingCode, { agentScopeUid: agentScopeUid || undefined });
    }

    // Minimal backfill:
    // - If assignedAgentUid exists but assignedAgentName missing, keep as-is (UI handles).
    // - Do NOT guess createdByUid; leave empty unless present.
    if (!createdByUid && !assignedAgentUid) continue;
    // no-op: we only normalize trims here if needed
    const patch: Record<string, unknown> = {};
    if (typeof data.createdByUid === "string" && data.createdByUid !== createdByUid) patch.createdByUid = createdByUid;
    if (typeof data.assignedAgentUid === "string" && data.assignedAgentUid !== assignedAgentUid) patch.assignedAgentUid = assignedAgentUid;
    if (Object.keys(patch).length > 0) listingUpdates.push({ ref: doc.ref, data: patch });
  }

  // Commit listing normalization
  {
    const batchSize = 400;
    for (let i = 0; i < listingUpdates.length; i += batchSize) {
      const batch = scopedDb.batch();
      for (const u of listingUpdates.slice(i, i + batchSize)) {
        batch.set(u.ref, u.data, { merge: true });
      }
      await batch.commit();
      console.log(`[${orgId}] listings normalized: ${Math.min(i + batchSize, listingUpdates.length)}/${listingUpdates.length}`);
    }
  }

  // Backfill leads.assignedAgentUid from listing assignment or creator by listingCode.
  const leadsSnap = await leadsRef.get();
  const leadUpdates: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
  for (const doc of leadsSnap.docs) {
    const data = doc.data() as OrgLeadDoc;
    const listingCode = typeof data.listingCode === "string" ? data.listingCode.trim() : "";
    if (!listingCode || listingCode === "__pending__") continue;

    const currentAssigned = typeof data.assignedAgentUid === "string" ? data.assignedAgentUid.trim() : "";
    const listingAssigned = listingByCode.get(listingCode)?.agentScopeUid || "";
    if (!listingAssigned) continue;
    if (currentAssigned === listingAssigned) continue;

    leadUpdates.push({ ref: doc.ref, data: { assignedAgentUid: listingAssigned } });
  }

  const batchSize = 400;
  for (let i = 0; i < leadUpdates.length; i += batchSize) {
    const batch = scopedDb.batch();
    for (const u of leadUpdates.slice(i, i + batchSize)) {
      batch.set(u.ref, u.data, { merge: true });
    }
    await batch.commit();
    console.log(`[${orgId}] leads backfilled: ${Math.min(i + batchSize, leadUpdates.length)}/${leadUpdates.length}`);
  }

  // Backfill conversations.assignedAgentUid from listing assignment or creator by listingCode.
  const convSnap = await conversationsRef.get();
  const convUpdates: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
  for (const doc of convSnap.docs) {
    const data = doc.data() as OrgConversationDoc;
    const listingCode = typeof data.listingCode === "string" ? data.listingCode.trim() : "";
    if (!listingCode || listingCode === "__pending__") continue;

    const currentAssigned = typeof data.assignedAgentUid === "string" ? data.assignedAgentUid.trim() : "";
    const listingAssigned = listingByCode.get(listingCode)?.agentScopeUid || "";
    if (!listingAssigned) continue;
    if (currentAssigned === listingAssigned) continue;

    convUpdates.push({ ref: doc.ref, data: { assignedAgentUid: listingAssigned } });
  }

  for (let i = 0; i < convUpdates.length; i += batchSize) {
    const batch = scopedDb.batch();
    for (const u of convUpdates.slice(i, i + batchSize)) {
      batch.set(u.ref, u.data, { merge: true });
    }
    await batch.commit();
    console.log(`[${orgId}] conversations backfilled: ${Math.min(i + batchSize, convUpdates.length)}/${convUpdates.length}`);
  }
}

async function main() {
  const orgsSnap = await scopedDb.collection("organizations").get();
  console.log(`Organizations: ${orgsSnap.docs.length}`);
  for (const doc of orgsSnap.docs) {
    const orgId = doc.id;
    console.log(`Backfilling org ${orgId}...`);
    await backfillOrg(orgId);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

