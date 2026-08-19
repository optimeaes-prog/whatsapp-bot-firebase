/**
 * Integration tests for the lead-row rules, against the Firestore emulator.
 *
 * The unit tests cover the pure rules (which row to pick, what to copy). These
 * cover the part the unit tests cannot: WHICH DOCUMENT actually gets written.
 * Every bug we hit in this area lived exactly there — a write landing on the
 * wrong row, or a row left behind — so it needs a real database to prove.
 *
 * Run with:  npm run test:integration
 * (skips itself, loudly, if the emulator is not running)
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Without the emulator every test here skips and every helper is inert. These
// tests delete documents, so they must never be able to reach a real project:
// the guard is on the writes themselves, not only on the test list.
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || "";
const skip = EMULATOR ? false : "needs the Firestore emulator — run npm run test:integration";

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "real-estate-idealista-bot";
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

import { requestContext } from "../services/requestContext";
import {
  createPendingCallLead,
  updateLeadChatInfo,
  updateLeadListingByChatId,
  updateLeadStatus,
  setLeadConsentByChatId,
  findLeadDocForChat,
} from "../services/firestore";

const ORG = "org_test_lead_rows";
const DB = getFirestore(admin.app(), "realestate-whatsapp-bot");
// Match production, which sets this once at startup (index.ts). Without it the
// admin SDK rejects the optional fields these writers legitimately leave unset.
DB.settings({ ignoreUndefinedProperties: true });
const leads = DB.collection(`organizations/${ORG}/leads`);

const PHONE = "34644402838";
const CHAT = `${PHONE}@s.whatsapp.net`;
const AD_A = "111349077";
const AD_B = "112009850";
const PLACEHOLDER = `lead_${PHONE}___pending__`;

const inOrg = <T>(fn: () => Promise<T>): Promise<T> => requestContext.run({ orgId: ORG }, fn);

async function reset() {
  if (!EMULATOR) return;
  const snap = await leads.get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

type Row = Record<string, unknown> & { id: string };

async function rows(): Promise<Row[]> {
  const snap = await leads.get();
  return snap.docs
    .map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

test.beforeEach(reset);
test.after(reset);

// ---------------------------------------------------------------------------
// The reported bug: a lead who called, whose property is identified later.
// ---------------------------------------------------------------------------

test("a call lead ends up as ONE row on its real property", { skip }, async () => {
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT, callFlowMode: "per_org" });
    await setLeadConsentByChatId({
      chatId: CHAT,
      phone: PHONE,
      listingCode: "__pending__",
      consent: { capturedAt: admin.firestore.Timestamp.now(), source: "phone_call", proofUrl: "CA123" },
    });
    await updateLeadStatus({ chatId: CHAT, name: "Riccardo", qualificationStatus: "not_qualified" });

    // The chat works out which flat the caller meant.
    await updateLeadListingByChatId({
      chatId: CHAT,
      phone: PHONE,
      listingCode: AD_A,
      listingResolutionStatus: "resolved",
    });

    // Whatever writes next must find that same row, not create another.
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT });
    await updateLeadStatus({ chatId: CHAT, qualificationStatus: "qualified", listingCode: AD_A });
  });

  const all = await rows();
  assert.equal(all.length, 1, `expected exactly one row, got ${all.map((r) => r.id).join(", ")}`);
  assert.equal(all[0].id, `lead_${PHONE}_${AD_A}`);
  assert.equal(all[0].listingCode, AD_A);
  assert.equal(all[0].name, "Riccardo", "the name captured during the call must survive the move");
  assert.ok(all[0].consent, "the consent proof must survive the move");
  assert.equal(all[0].qualificationStatus, "qualified");
});

test("the placeholder row is gone once the property is known", { skip }, async () => {
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    assert.ok((await leads.doc(PLACEHOLDER).get()).exists, "placeholder should exist during the call");
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: AD_A, listingResolutionStatus: "resolved",
    });
  });
  assert.equal((await leads.doc(PLACEHOLDER).get()).exists, false);
});

// ---------------------------------------------------------------------------
// Bug 1 + 2: a caller who ALREADY has a row for another property.
// ---------------------------------------------------------------------------

test("resolving a call does not steal or delete another property's row", { skip }, async () => {
  await inOrg(async () => {
    // The lead already enquired about ad A through Idealista.
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, name: "Riccardo" });
    await updateLeadStatus({ chatId: CHAT, qualificationStatus: "qualified", listingCode: AD_A });
    // Then they call, and the call turns out to be about ad B.
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: AD_B, listingResolutionStatus: "resolved",
    });
  });

  const all = await rows();
  const a = all.find((r) => r.id === `lead_${PHONE}_${AD_A}`);
  const b = all.find((r) => r.id === `lead_${PHONE}_${AD_B}`);
  assert.ok(a, "the row for ad A must still exist");
  assert.equal(a!.listingCode, AD_A, "ad A's row must keep its own property");
  assert.equal(a!.qualificationStatus, "qualified", "ad A's qualification must not move");
  assert.ok(b, "ad B must get its own row");
  assert.equal(all.length, 2, `expected A and B only, got ${all.map((r) => r.id).join(", ")}`);
  assert.equal(
    (await leads.doc(PLACEHOLDER).get()).exists,
    false,
    "the placeholder must not be left behind"
  );
});

// ---------------------------------------------------------------------------
// Bug 3: the call flow fails to identify the property.
// ---------------------------------------------------------------------------

test("a failed lookup never stamps __pending__ over a real property", { skip }, async () => {
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, name: "Riccardo" });
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: "__pending__", listingResolutionStatus: "failed",
    });
  });

  const a = (await leads.doc(`lead_${PHONE}_${AD_A}`).get()).data() as Record<string, unknown>;
  assert.equal(a.listingCode, AD_A, "ad A's row must still point at ad A");
  assert.equal(a.listingResolutionStatus, undefined, "the failure belongs to the placeholder row");
  const placeholder = (await leads.doc(PLACEHOLDER).get()).data() as Record<string, unknown>;
  assert.equal(placeholder.listingResolutionStatus, "failed");
});

// ---------------------------------------------------------------------------
// The agency's model: one person, two properties, two rows.
// ---------------------------------------------------------------------------

test("two properties means two rows, and the qualification lands on the right one", { skip }, async () => {
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT });
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_B, chatId: CHAT });
    await updateLeadStatus({ chatId: CHAT, qualificationStatus: "qualified", listingCode: AD_B });
  });

  const all = await rows();
  assert.equal(all.length, 2);
  const a = all.find((r) => r.id === `lead_${PHONE}_${AD_A}`)!;
  const b = all.find((r) => r.id === `lead_${PHONE}_${AD_B}`)!;
  assert.equal(b.qualificationStatus, "qualified", "the property under discussion gets the status");
  assert.notEqual(a.qualificationStatus, "qualified", "the other property must not be qualified");
});

test("the person's name and consent appear on every one of their rows", { skip }, async () => {
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT });
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_B, chatId: CHAT });
    await updateLeadStatus({ chatId: CHAT, name: "Renata", qualificationStatus: "not_qualified", listingCode: AD_B });
    await setLeadConsentByChatId({
      chatId: CHAT,
      phone: PHONE,
      listingCode: AD_B,
      consent: { capturedAt: admin.firestore.Timestamp.now(), source: "inbound_whatsapp" },
    });
  });

  const all = await rows();
  assert.equal(all.length, 2);
  for (const row of all) {
    assert.equal(row.name, "Renata", `row ${row.id} should carry the person's name`);
    assert.ok(row.consent, `row ${row.id} should carry the person's consent`);
  }
});

test("asking again about the same property updates the row instead of adding one", { skip }, async () => {
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, name: "Ana" });
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, tags: ["lead"] });
  });
  const all = await rows();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, "Ana");
});

// ---------------------------------------------------------------------------
// The lookup rule, against real documents rather than plain objects.
// ---------------------------------------------------------------------------

test("the lookup returns the row of the property the chat is about", { skip }, async () => {
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, name: "Ana" });
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_B, chatId: CHAT });
    const chosen = await findLeadDocForChat(CHAT, AD_B);
    assert.equal(chosen?.id, `lead_${PHONE}_${AD_B}`);
    const other = await findLeadDocForChat(CHAT, AD_A);
    assert.equal(other?.id, `lead_${PHONE}_${AD_A}`);
  });
});

// ---------------------------------------------------------------------------
// The 53 pairs already in the database. They stay as they are; the question is
// where a NEW change lands. Seeded to match the real rows, including the giveaway
// that a legacy placeholder keeps its "__pending__" document id while its
// listingCode field was overwritten with the real property by the old code.
// ---------------------------------------------------------------------------

async function seed(id: string, data: Record<string, unknown>) {
  await leads.doc(id).set({ phone: PHONE, chatId: CHAT, ...data });
}

test("a change to the reported pair lands on the populated row", { skip }, async () => {
  // Exactly pair #1 from the audit: both rows carry ad 111349077, one is the
  // call placeholder with no name, the other is "Cristina florido", qualified.
  await seed(PLACEHOLDER, {
    listingCode: AD_A, leadSource: "call", qualificationStatus: "not_qualified",
    consent: { source: "phone_call" },
  });
  await seed(`lead_${PHONE}_${AD_A}`, {
    listingCode: AD_A, name: "Cristina florido", qualificationStatus: "qualified",
    consent: { source: "inbound_whatsapp" }, conversationSummary: "resumen",
  });

  await inOrg(() => updateLeadStatus({
    chatId: CHAT, qualificationStatus: "rejected", notes: "cambió de opinión", listingCode: AD_A,
  }));

  const all = await rows();
  assert.equal(all.length, 2, "no new row may appear");
  const populated = all.find((r) => r.id === `lead_${PHONE}_${AD_A}`)!;
  const empty = all.find((r) => r.id === PLACEHOLDER)!;
  assert.equal(populated.qualificationStatus, "rejected", "the change goes to the populated row");
  assert.equal(populated.notes, "cambió de opinión");
  assert.equal(empty.qualificationStatus, "not_qualified", "the empty twin is left alone");
  assert.equal(empty.notes, undefined);
});

test("a legacy placeholder that never resolved keeps out of the way", { skip }, async () => {
  await seed(PLACEHOLDER, { listingCode: "__pending__", leadSource: "call", qualificationStatus: "not_qualified" });
  await seed(`lead_${PHONE}_${AD_A}`, { listingCode: AD_A, name: "Encarni", qualificationStatus: "qualified" });

  await inOrg(() => updateLeadStatus({ chatId: CHAT, qualificationStatus: "rejected", listingCode: AD_A }));

  const all = await rows();
  assert.equal(all.length, 2);
  assert.equal(all.find((r) => r.id === `lead_${PHONE}_${AD_A}`)!.qualificationStatus, "rejected");
  const placeholder = all.find((r) => r.id === PLACEHOLDER)!;
  assert.equal(placeholder.qualificationStatus, "not_qualified");
  assert.equal(placeholder.listingCode, "__pending__", "its property is not rewritten");
});

test("an existing two-ads pair gets the change on the ad being discussed", { skip }, async () => {
  await seed(`lead_${PHONE}_${AD_A}`, { listingCode: AD_A, name: "Renata", qualificationStatus: "qualified" });
  await seed(`lead_${PHONE}_${AD_B}`, { listingCode: AD_B, name: "Renata" });

  await inOrg(() => updateLeadStatus({ chatId: CHAT, qualificationStatus: "rejected", listingCode: AD_B }));

  const all = await rows();
  assert.equal(all.length, 2, "no third row");
  assert.equal(all.find((r) => r.id === `lead_${PHONE}_${AD_B}`)!.qualificationStatus, "rejected");
  assert.equal(
    all.find((r) => r.id === `lead_${PHONE}_${AD_A}`)!.qualificationStatus,
    "qualified",
    "the other ad keeps its own status"
  );
});

test("an intake on one of the existing pairs collapses it, losing nothing", { skip }, async () => {
  // One of the 53 pairs already in production: the legacy stub kept its
  // "__pending__" document id while the old code overwrote its listingCode with
  // the real property. An intake for that property now absorbs it — a cleanup,
  // but a real change to live rows, so exactly what survives is asserted here.
  await seed(PLACEHOLDER, {
    listingCode: AD_A, leadSource: "call", qualificationStatus: "not_qualified",
    consent: { source: "phone_call" }, recordings: ["rec_1"],
  });
  await seed(`lead_${PHONE}_${AD_A}`, { listingCode: AD_A, name: "Cristina florido" });

  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, tags: ["lead"] });
    await updateLeadStatus({
      chatId: CHAT, name: "Cristina florido", qualificationStatus: "qualified", listingCode: AD_A,
    });
  });

  const all = await rows();
  assert.equal(all.length, 1, `the pair collapses, got ${all.map((r) => r.id).join(", ")}`);
  assert.equal(all[0].id, `lead_${PHONE}_${AD_A}`, "the property's row is the one that survives");
  assert.equal(all[0].name, "Cristina florido", "the populated row keeps its own name");
  assert.equal(all[0].qualificationStatus, "qualified");
  assert.ok(all[0].consent, "the stub's consent proof is carried over, not dropped");
  assert.deepEqual(all[0].recordings, ["rec_1"], "and its call recordings");
});

// ---------------------------------------------------------------------------
// Two ways an existing pair does NOT stay untouched. Both are improvements, but
// they are changes to live rows, so they are pinned down here deliberately.
// ---------------------------------------------------------------------------

test("the empty twin of an existing pair gains the person's name and consent", { skip }, async () => {
  await seed(PLACEHOLDER, { listingCode: AD_A, leadSource: "call", qualificationStatus: "not_qualified" });
  await seed(`lead_${PHONE}_${AD_A}`, { listingCode: AD_A, name: "Cristina florido" });

  await inOrg(() => updateLeadStatus({
    chatId: CHAT, name: "Cristina florido", qualificationStatus: "qualified", listingCode: AD_A,
  }));

  const twin = (await leads.doc(PLACEHOLDER).get()).data() as Record<string, unknown>;
  assert.equal(twin.name, "Cristina florido", "identity is mirrored onto the twin");
  assert.equal(twin.qualificationStatus, "not_qualified", "but not the qualification");
});

test("a fresh call on an existing pair collapses it instead of adding a third row", { skip }, async () => {
  // The legacy placeholder still carries the "__pending__" DOCUMENT ID even
  // though the old code overwrote its listingCode field with the real property.
  await seed(PLACEHOLDER, {
    listingCode: AD_A, leadSource: "call", consent: { source: "phone_call" },
    qualificationStatus: "not_qualified",
  });
  await seed(`lead_${PHONE}_${AD_A}`, {
    listingCode: AD_A, name: "Cristina florido", qualificationStatus: "qualified",
  });

  await inOrg(() => updateLeadListingByChatId({
    chatId: CHAT, phone: PHONE, listingCode: AD_A, listingResolutionStatus: "resolved",
  }));

  const all = await rows();
  assert.equal(all.length, 1, "the pair is merged, not tripled");
  assert.equal(all[0].id, `lead_${PHONE}_${AD_A}`);
  assert.equal(all[0].name, "Cristina florido", "the populated row's data wins");
  assert.equal(all[0].qualificationStatus, "qualified", "nothing is downgraded");
  assert.ok(all[0].consent, "the placeholder's consent proof is kept");
});

// ---------------------------------------------------------------------------
// The "Francisco" incident (14 Aug): a lead who called, qualified, and then
// called a SECOND time. The second call reused the placeholder row — which was
// still this lead's only row — and reset it to not_qualified, leaving the
// summary behind. The agency saw "Ver Resumen" on a "No cualificado" lead, and
// he reappeared in the cold-leads list.
// ---------------------------------------------------------------------------

test("a second call does not undo the qualification of the first", { skip }, async () => {
  const AD = "112281411";
  await inOrg(async () => {
    // Call #1, the chat identifies the property, the lead qualifies.
    await createPendingCallLead({ phone: PHONE, chatId: CHAT, callFlowMode: "per_org" });
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: AD, listingResolutionStatus: "resolved",
    });
    await updateLeadStatus({
      chatId: CHAT, name: "Francisco", qualificationStatus: "qualified",
      conversationSummary: "Lead cualificado ✅ Propiedad: Mediterraneo", listingCode: AD,
    });

    // Call #2, two hours later.
    await createPendingCallLead({ phone: PHONE, chatId: CHAT, callFlowMode: "per_org" });
  });

  const qualified = (await leads.doc(`lead_${PHONE}_${AD}`).get()).data() as Record<string, unknown>;
  assert.equal(qualified.qualificationStatus, "qualified", "the second call must not downgrade the lead");
  assert.equal(qualified.listingCode, AD, "nor reset the property to the placeholder");
  assert.equal(qualified.name, "Francisco");
  assert.ok(qualified.conversationSummary, "the summary stays with the qualified row");
});

test("the second call's own row merges back without downgrading anything", { skip }, async () => {
  const AD = "112281411";
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: AD, listingResolutionStatus: "resolved",
    });
    await updateLeadStatus({
      chatId: CHAT, name: "Francisco", qualificationStatus: "qualified",
      conversationSummary: "Lead cualificado ✅", listingCode: AD,
    });
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: AD, listingResolutionStatus: "resolved",
    });
  });

  const all = await rows();
  assert.equal(all.length, 1, `expected one row, got ${all.map((r) => r.id).join(", ")}`);
  assert.equal(all[0].id, `lead_${PHONE}_${AD}`);
  assert.equal(all[0].qualificationStatus, "qualified");
  assert.ok(all[0].conversationSummary);
});

test("a second call cannot undo a qualification even if the property never resolved", { skip }, async () => {
  // Francisco's row never moved because its listing was resolved; this is the
  // harder case — the lead qualifies while still on the placeholder row.
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadStatus({
      chatId: CHAT, name: "Francisco", qualificationStatus: "qualified",
      conversationSummary: "Lead cualificado ✅",
    });
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
  });

  const all = await rows();
  assert.equal(all.length, 1);
  assert.equal(all[0].qualificationStatus, "qualified", "the second call must not downgrade it");
  assert.equal(all[0].name, "Francisco");
  assert.ok(all[0].conversationSummary);
});

// ---------------------------------------------------------------------------
// The "Karim" incident (18 Aug): he phoned at 14:38 and hung up without pressing
// 1, so the call left a stub and never learned the property. Ten minutes later an
// Idealista intake for ad 112306757 arrived — the property came in through the
// OTHER door, where the folding did not run, and the stub was orphaned.
// ---------------------------------------------------------------------------

test("an Idealista intake absorbs the stub left by an unanswered call", { skip }, async () => {
  const AD = "112306757";
  await inOrg(async () => {
    // 14:38 — he calls and hangs up: a stub, no name, no consent, no property.
    await createPendingCallLead({ phone: PHONE, chatId: CHAT, callFlowMode: "per_org" });
    // 14:48 — the Idealista form arrives, property known from the first instant.
    await updateLeadChatInfo({
      phone: PHONE, listingCode: AD, chatId: CHAT, name: "Karim", qualificationStatus: "not_qualified",
    });
  });

  const all = await rows();
  assert.equal(all.length, 1, `expected one row, got ${all.map((r) => r.id).join(", ")}`);
  assert.equal(all[0].id, `lead_${PHONE}_${AD}`, "the row named after the property survives");
  assert.equal(all[0].listingCode, AD);
  assert.equal(all[0].name, "Karim");
  assert.equal((await leads.doc(PLACEHOLDER).get()).exists, false, "the stub is gone");
});

test("what the call did capture travels into the intake's row", { skip }, async () => {
  const AD = "112306757";
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT, name: "Karim" });
    // He pressed 1 on the call, so consent was recorded against the stub.
    await setLeadConsentByChatId({
      chatId: CHAT, phone: PHONE, listingCode: "__pending__",
      consent: { capturedAt: admin.firestore.Timestamp.now(), source: "phone_call", proofUrl: "CA999" },
    });
    // The intake knows the property but carries no name and no consent.
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD, chatId: CHAT });
  });

  const all = await rows();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, "Karim", "the name captured on the call is not lost");
  assert.ok(all[0].consent, "nor the consent proof");
  assert.equal((all[0].consent as { source?: string }).source, "phone_call");
});

test("the surviving row keeps the intake's own start date", { skip }, async () => {
  const AD = "112306757";
  let stubCreatedAt = 0;
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    const stub = (await leads.doc(PLACEHOLDER).get()).data() as Record<string, unknown>;
    stubCreatedAt = (stub.createdAt as { toMillis: () => number }).toMillis();
    await new Promise((r) => setTimeout(r, 25));
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD, chatId: CHAT, name: "Karim" });
  });

  const row = (await leads.doc(`lead_${PHONE}_${AD}`).get()).data() as Record<string, unknown>;
  const createdAt = (row.createdAt as { toMillis: () => number }).toMillis();
  assert.ok(
    createdAt > stubCreatedAt,
    `the row should date from the intake (${createdAt}), not the earlier call (${stubCreatedAt})`
  );
});

test("a stub is never folded into another property's lead by accident", { skip }, async () => {
  // Two real properties plus a stub: the intake for B must absorb the stub, and
  // A must be left completely alone.
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_A, chatId: CHAT, name: "Karim" });
    await updateLeadStatus({ chatId: CHAT, qualificationStatus: "qualified", listingCode: AD_A });
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD_B, chatId: CHAT });
  });

  const all = await rows();
  assert.equal(all.length, 2, `expected A and B only, got ${all.map((r) => r.id).join(", ")}`);
  assert.equal(all.find((r) => r.id === `lead_${PHONE}_${AD_A}`)!.qualificationStatus, "qualified");
  assert.ok(all.find((r) => r.id === `lead_${PHONE}_${AD_B}`), "B has its own row");
  assert.equal((await leads.doc(PLACEHOLDER).get()).exists, false, "the stub is absorbed, not left over");
});

test("a call that arrives after the intake still leaves a stub until it resolves", { skip }, async () => {
  // The known edge, pinned down rather than assumed: this stub is a genuinely
  // unresolved call, so it stays until its own chat identifies a property.
  const AD = "112306757";
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD, chatId: CHAT, name: "Karim" });
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
  });

  assert.equal((await rows()).length, 2, "documented behaviour: the stub waits for its property");

  // ...and once that call does identify the property, it folds in.
  await inOrg(() => updateLeadListingByChatId({
    chatId: CHAT, phone: PHONE, listingCode: AD, listingResolutionStatus: "resolved",
  }));
  const all = await rows();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, `lead_${PHONE}_${AD}`);
});



// ---------------------------------------------------------------------------
// A caller who is already a lead. The stub is kept on purpose — it is the only
// visible sign that they rang again, and the call may well be about another
// flat — but it has to say WHO called.
// ---------------------------------------------------------------------------

test("a second call from a known lead shows their name, not an anonymous row", { skip }, async () => {
  const AD = "112306757";
  await inOrg(async () => {
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
    await updateLeadListingByChatId({
      chatId: CHAT, phone: PHONE, listingCode: AD, listingResolutionStatus: "resolved",
    });
    await updateLeadStatus({ chatId: CHAT, name: "Karim", qualificationStatus: "qualified", listingCode: AD });
    // He rings again and hangs up.
    await createPendingCallLead({ phone: PHONE, chatId: CHAT });
  });

  const all = await rows();
  assert.equal(all.length, 2, "the call is still recorded as its own row");
  const stub = all.find((r) => r.id === PLACEHOLDER)!;
  assert.equal(stub.name, "Karim", "the agent should see who called");
  assert.equal(stub.listingCode, "__pending__", "the property is still genuinely unknown");
  assert.equal(stub.qualificationStatus, "not_qualified");
  const real = all.find((r) => r.id === `lead_${PHONE}_${AD}`)!;
  assert.equal(real.qualificationStatus, "qualified", "his real lead is untouched");
});

test("a first-ever call from a stranger stays nameless", { skip }, async () => {
  await inOrg(() => createPendingCallLead({ phone: PHONE, chatId: CHAT }));
  const all = await rows();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, undefined, "there is no name to show yet, and none is invented");
});

test("a name captured on the call itself still wins", { skip }, async () => {
  const AD = "112306757";
  await inOrg(async () => {
    await updateLeadChatInfo({ phone: PHONE, listingCode: AD, chatId: CHAT, name: "Karim" });
    await createPendingCallLead({ phone: PHONE, chatId: CHAT, name: "Karim Ben" });
  });
  const stub = (await leads.doc(PLACEHOLDER).get()).data() as Record<string, unknown>;
  assert.equal(stub.name, "Karim Ben", "what the call captured is not overwritten by the older row");
});
