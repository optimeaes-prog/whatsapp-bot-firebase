import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// One-off backfill for conversations created before the persistence fix that
// landed 2026-05-27. Inbound webhooks (twilioWebhook + whatsappWebhook) used
// to write only `{ history }` on first contact, leaving `type` and `tags`
// undefined on the doc. The UI filter at Conversations.tsx:416 treats
// `undefined.includes("non-lead")` as falsy, so non-lead conversations
// incorrectly show up under the "LEADS" tab.
//
// This script walks every org's `conversations` collection. For each doc
// missing `tags`/`type`, it computes the right value based on whether the
// conversation matches a known Lead (or has `listingCode` set) and persists
// the missing fields.
//
// Run:
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json \
//   npx ts-node functions/src/scripts/backfill_conversation_tags.ts
//
// Or with firebase login + ADC:
//   npx ts-node functions/src/scripts/backfill_conversation_tags.ts
//
// Pass `--dry-run` to see what would change without writing.

const DATABASE_ID = "realestate-whatsapp-bot";
const DRY_RUN = process.argv.includes("--dry-run");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore(admin.app(), DATABASE_ID);

type ConvDoc = {
  chatId?: string;
  phone?: string;
  listingCode?: string;
  type?: "lead" | "non-lead";
  tags?: string[];
};

type LeadDoc = {
  chatId?: string;
  phone?: string;
  listingCode?: string;
};

async function findLeadForConversation(
  orgId: string,
  conv: ConvDoc,
  docId: string
): Promise<LeadDoc | null> {
  const leadsRef = db.collection(`organizations/${orgId}/leads`);

  // Try by chatId first (canonical match).
  const chatIdCandidates = [conv.chatId, docId].filter((s): s is string => !!s);
  for (const candidate of chatIdCandidates) {
    const snap = await leadsRef.where("chatId", "==", candidate).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as LeadDoc;
  }

  // Fall back to phone.
  if (conv.phone) {
    const snap = await leadsRef.where("phone", "==", conv.phone).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as LeadDoc;
  }

  return null;
}

async function backfillOrg(orgId: string): Promise<{
  total: number;
  alreadyOk: number;
  fixedLead: number;
  fixedNonLead: number;
}> {
  const convsRef = db.collection(`organizations/${orgId}/conversations`);
  const snap = await convsRef.get();
  let alreadyOk = 0;
  let fixedLead = 0;
  let fixedNonLead = 0;

  for (const doc of snap.docs) {
    const conv = doc.data() as ConvDoc;
    if (conv.type && conv.tags && conv.tags.length > 0) {
      alreadyOk++;
      continue;
    }

    // Decide lead vs non-lead.
    let nextType: "lead" | "non-lead" = "non-lead";
    let nextTags: string[] = ["non-lead"];

    if (conv.listingCode) {
      nextType = "lead";
      nextTags = ["lead"];
    } else {
      const lead = await findLeadForConversation(orgId, conv, doc.id);
      if (lead && lead.listingCode) {
        nextType = "lead";
        nextTags = ["lead"];
      }
    }

    const patch: Partial<ConvDoc> = {};
    if (!conv.type) patch.type = nextType;
    if (!conv.tags || conv.tags.length === 0) patch.tags = nextTags;

    const action = nextType === "lead" ? "lead" : "non-lead";
    console.log(
      `[${orgId}] ${doc.id}: ${conv.type || "?"}/${(conv.tags || []).join(",") || "?"} -> ${action}/${nextTags.join(",")}`
    );

    if (!DRY_RUN) {
      await doc.ref.set(patch, { merge: true });
    }

    if (nextType === "lead") fixedLead++;
    else fixedNonLead++;
  }

  return { total: snap.size, alreadyOk, fixedLead, fixedNonLead };
}

async function main() {
  console.log(`backfill_conversation_tags (dry-run: ${DRY_RUN})`);
  const orgsSnap = await db.collection("organizations").get();
  let grandTotal = 0;
  let grandOk = 0;
  let grandLead = 0;
  let grandNonLead = 0;
  for (const org of orgsSnap.docs) {
    const result = await backfillOrg(org.id);
    grandTotal += result.total;
    grandOk += result.alreadyOk;
    grandLead += result.fixedLead;
    grandNonLead += result.fixedNonLead;
    console.log(
      `[${org.id}] total=${result.total} alreadyOk=${result.alreadyOk} ` +
        `fixedLead=${result.fixedLead} fixedNonLead=${result.fixedNonLead}`
    );
  }
  console.log(
    `DONE: total=${grandTotal} alreadyOk=${grandOk} ` +
      `fixedLead=${grandLead} fixedNonLead=${grandNonLead} (dry-run: ${DRY_RUN})`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
