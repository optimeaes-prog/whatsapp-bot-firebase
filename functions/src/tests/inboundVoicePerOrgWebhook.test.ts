import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

test("voiceWebhook resolves the org from the dialed (To) number, verifies dual-token, and gates on the per-org flag", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /export const voiceWebhook[\s\S]*?resolveOrgIdByVoiceNumber\(body\.To\)/,
    "voiceWebhook should resolve the org from body.To"
  );
  assert.match(
    src,
    /export const voiceWebhook[\s\S]*?getOrgTwilioAuthToken\(voiceOrgId\)/,
    "voiceWebhook should fall back to the resolved org's subaccount token (dual-token verify)"
  );
  assert.match(
    src,
    /export const voiceWebhook[\s\S]*?inboundVoicePerOrgEnabled === true/,
    "voiceWebhook should gate the new flow on the per-org flag"
  );
});

test("voiceWebhook per-org branch passes orgId/callFlowMode in the gather URL and tags the pending lead", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(src, /callFlowMode=per_org/, "gather URL should carry callFlowMode=per_org");
  assert.match(src, /&orgId=\$\{encodeURIComponent\(voiceOrgId\)\}/, "gather URL should carry the resolved orgId");
  assert.match(
    src,
    /createPendingCallLead\(\{ phone: fromPhone, chatId, callFlowMode: "per_org" \}\)/,
    "the pending lead/conversation must be created with the per_org marker"
  );
});

test("voiceGatherCallback per-org sends the opt-in from the org, charges one credit, and supports subaccount signatures", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /export const voiceGatherCallback[\s\S]*?getOrgTwilioAuthToken\(queryOrgId\)/,
    "voiceGatherCallback should verify with the resolved org's subaccount token"
  );
  // Consent + template send still happen (shared with the legacy branch).
  assert.match(
    src,
    /export const voiceGatherCallback[\s\S]*?recordVoiceConsent\([\s\S]*?getVoiceOptInTemplateSid\([\s\S]*?sendInitialTemplateMessage\(/,
    "voiceGatherCallback should record consent and send the opt-in template"
  );
  // Per-org billing: a single deduction with the per-org idempotency key + label.
  assert.match(
    src,
    /isPerOrgGather[\s\S]*?deductOrgConversationOnce\([\s\S]*?"initialOutboundCreditsDeducted"[\s\S]*?"Inbound voice opt-in \(per-org\)"/,
    "per-org gather should charge one credit via deductOrgConversationOnce"
  );
});
