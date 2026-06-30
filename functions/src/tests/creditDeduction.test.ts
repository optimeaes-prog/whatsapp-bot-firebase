import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

const billingSource = readRepoFile("src/services/billingService.ts");
const indexSource = readRepoFile("src/index.ts");

test("deductOrgConversationOnce: runs inside a Firestore transaction", () => {
  const fnBlock = billingSource.match(
    /export async function deductOrgConversationOnce[\s\S]*?\n\}\n/
  );
  assert.ok(fnBlock, "deductOrgConversationOnce must exist");
  assert.match(fnBlock![0], /db\.runTransaction/, "must use runTransaction");
});

test("deductOrgConversationOnce: idempotency key is parameterized per call site", () => {
  const fnBlock = billingSource.match(
    /export async function deductOrgConversationOnce[\s\S]*?\n\}\n/
  )![0];
  assert.match(
    fnBlock,
    /convSnap\.data\(\)\?\.\[idempotencyField\] === true/,
    "must read the dynamic field when checking idempotency"
  );
  assert.match(
    fnBlock,
    /transaction\.set\(convRef, \{ \[idempotencyField\]: true \}/,
    "must set the dynamic field inside the same transaction as the balance decrement"
  );
});

test("CreditIdempotencyField enumerates exactly the two chargeable events", () => {
  assert.match(
    billingSource,
    /"initialOutboundCreditsDeducted"[\s\S]*?"intakeOutboundCreditsDeducted"/,
    "both idempotency-field literals must be declared in the union"
  );
});

test("deductOrgConversationOnce: throws when balance insufficient", () => {
  const fnBlock = billingSource.match(
    /export async function deductOrgConversationOnce[\s\S]*?\n\}\n/
  )![0];
  assert.match(
    fnBlock,
    /if \(currentBalance < amount\)[\s\S]*?throw new Error/,
    "must throw when balance < amount to keep ledger consistent"
  );
});

test("deductOrgConversationOnce: writes ledger entry only after deduction commits", () => {
  const fnBlock = billingSource.match(
    /export async function deductOrgConversationOnce[\s\S]*?\n\}\n/
  )![0];
  const txnIdx = fnBlock.indexOf("await db.runTransaction");
  const ledgerIdx = fnBlock.indexOf('collection("creditTransactions")');
  assert.ok(txnIdx >= 0 && ledgerIdx >= 0, "transaction and ledger write must both exist");
  assert.ok(
    ledgerIdx > txnIdx,
    "ledger entry must be written AFTER the transaction commits, never inside it"
  );
});

test("deductOrgConversationForInitialOutboundOnce: still exists as a back-compat wrapper", () => {
  const fnBlock = billingSource.match(
    /export async function deductOrgConversationForInitialOutboundOnce[\s\S]*?\n\}\n/
  );
  assert.ok(fnBlock, "back-compat wrapper must still exist");
  assert.match(
    fnBlock![0],
    /return deductOrgConversationOnce\(orgId, chatId, "initialOutboundCreditsDeducted"/,
    "wrapper must delegate to the generalized function with the initial-outbound field"
  );
});

test("index.ts: imports both the wrapper and the generalized deduction function", () => {
  assert.match(
    indexSource,
    /import \{[\s\S]*?deductOrgConversationForInitialOutboundOnce[\s\S]*?\} from "\.\/services\/billingService"/,
    "must import the back-compat wrapper"
  );
  assert.match(
    indexSource,
    /import \{[\s\S]*?deductOrgConversationOnce[\s\S]*?\} from "\.\/services\/billingService"/,
    "must import the generalized function"
  );
});

test("index.ts: Idealista new-lead send charges 1 credit on the active org (initial outbound)", () => {
  const sendIdx = indexSource.indexOf('mediaUrl: "https://real-estate-idealista-bot.web.app/idealista.jpg"');
  assert.ok(sendIdx > 0, "Idealista send site must exist");
  const window = indexSource.slice(sendIdx, sendIdx + 1500);
  assert.match(
    window,
    /deductOrgConversationForInitialOutboundOnce\(\s*getActiveOrgId\(\),/,
    "Idealista send must deduct on getActiveOrgId() within ~1500 chars"
  );
  assert.match(window, /"Idealista new lead"/, "deduction must carry an Idealista description");
  // Idealista direct leads must NOT charge the intake credit — there is no intake send.
  assert.doesNotMatch(
    window,
    /intakeOutboundCreditsDeducted/,
    "Idealista direct lead must not include the intake-outbound charge"
  );
});

test("chargeDestinationOrgForHandoff: charges both intake + handoff credits on targetOrgId", () => {
  const fnBlock = indexSource.match(
    /async function chargeDestinationOrgForHandoff[\s\S]*?\n\}\n/
  );
  assert.ok(fnBlock, "chargeDestinationOrgForHandoff helper must exist");
  const body = fnBlock![0];
  assert.match(
    body,
    /deductOrgConversationOnce\(\s*targetOrgId,\s*chatId,\s*"intakeOutboundCreditsDeducted"/,
    "must charge the intake-outbound credit on the destination org"
  );
  assert.match(
    body,
    /deductOrgConversationOnce\(\s*targetOrgId,\s*chatId,\s*"initialOutboundCreditsDeducted"/,
    "must charge the org's own initial-outbound credit on the destination org"
  );
  // Each charge must be wrapped independently so an insufficient-balance failure
  // on one does not skip the other.
  const tryCount = (body.match(/try \{/g) || []).length;
  assert.equal(tryCount, 2, "each of the two charges must be in its own try/catch block");
});

test("executeCrossOrgCallHandoff: both provider branches invoke chargeDestinationOrgForHandoff(targetOrgId, state.chatId, ...)", () => {
  const handoffIdx = indexSource.indexOf("async function executeCrossOrgCallHandoff");
  assert.ok(handoffIdx > 0, "executeCrossOrgCallHandoff function must exist");
  const body = indexSource.slice(handoffIdx, handoffIdx + 12000);
  const twilioCall = body.match(
    /chargeDestinationOrgForHandoff\(targetOrgId, state\.chatId, "twilio"\)/
  );
  const cloudApiCall = body.match(
    /chargeDestinationOrgForHandoff\(targetOrgId, state\.chatId, "cloud_api"\)/
  );
  assert.ok(twilioCall, "Twilio branch must call chargeDestinationOrgForHandoff");
  assert.ok(cloudApiCall, "Cloud API branch must call chargeDestinationOrgForHandoff");
});

test("index.ts: legacy intake voice flow does NOT charge at send time; per-org charges exactly once", () => {
  // The LEGACY voiceGatherCallback runs in PROPLEAD_INTAKE_ORG_ID — charging there would
  // self-bill Proplead, so the intake credit is collected later at handoff from the destination
  // org (`intakeOutboundCreditsDeducted`). The NEW per-org flow has no handoff, so it charges the
  // destination org ONCE at send time, guarded by `isPerOrgGather`.
  const perOrg = indexSource.match(/"Inbound voice opt-in \(per-org\)"/g) || [];
  assert.equal(perOrg.length, 1, "per-org voice opt-in should charge in exactly one place");
  assert.match(
    indexSource,
    /isPerOrgGather[\s\S]*?deductOrgConversationOnce\([\s\S]*?"initialOutboundCreditsDeducted",[\s\S]*?"Inbound voice opt-in \(per-org\)"/,
    "the per-org voice deduction must be guarded by isPerOrgGather (never the legacy intake path)"
  );

  const handoffMsgIdx = indexSource.indexOf("export const sendCallHandoffMessage");
  assert.ok(handoffMsgIdx > 0, "sendCallHandoffMessage must exist");
  const handoffMsgEnd = indexSource.indexOf("\n});", handoffMsgIdx);
  const handoffMsgBody = indexSource.slice(handoffMsgIdx, handoffMsgEnd);
  assert.doesNotMatch(
    handoffMsgBody,
    /deductOrgConversation/,
    "sendCallHandoffMessage (intake org) must not deduct credits at send time"
  );
});

test("index.ts: every deduction call site is inside a try/catch so billing cannot block a delivered message", () => {
  // Helper itself owns the two cross-org-handoff catches; Idealista site owns its own catch.
  const wrapped = indexSource.match(
    /deductOrgConversation(?:Once|ForInitialOutboundOnce)[\s\S]{0,500}?\}\s*catch \(err\)/g
  ) || [];
  // Expected: 2 inside chargeDestinationOrgForHandoff + 1 at Idealista site = 3.
  assert.equal(
    wrapped.length,
    3,
    `expected exactly 3 try/catch-wrapped deduction sites, found ${wrapped.length}`
  );
});
