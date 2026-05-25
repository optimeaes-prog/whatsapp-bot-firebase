import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("openai listing parser supports ranked candidates with confidence", () => {
  const source = readRepoFile("src/services/openaiClient.ts");
  assert.match(
    source,
    /function parseRankedCandidatesSegment[\s\S]*?entry\.split\("\|"\)[\s\S]*?confidence[\s\S]*?sort\(\(a, b\) => b\.confidence - a\.confidence\)/,
    "parseRankedCandidatesSegment should parse and sort per-listing confidence"
  );
  assert.match(
    source,
    /if \(kind === "ambiguous"\)[\s\S]*?rankedCandidates[\s\S]*?return \{ kind: "ambiguous", confidence, reason, candidates: rankedCandidates \};/,
    "ambiguous branch should return ranked candidates"
  );
});

test("call flow uses confidence gates and queue confirmation", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(source, /const MIN_CANDIDATE_CONFIDENCE = 0\.4;/, "min confidence constant should be defined");
  assert.match(source, /const AUTO_ACCEPT_CONFIDENCE = 0\.9;/, "auto-accept confidence constant should be defined");
  assert.match(
    source,
    /pendingListingQueue[\s\S]*?pendingListingQueueIndex[\s\S]*?rejectedListingCodes/,
    "conversation should persist queue state"
  );
  assert.match(
    source,
    /if \(decision === "deny"\)[\s\S]*?const nextIndex = queueIndex \+ 1;[\s\S]*?nextIndex < queue\.length/,
    "deny path should advance to next queued candidate"
  );
});

test("provider confirmation prompt uses interactive buttons with fallback", () => {
  const providerSource = readRepoFile("src/services/messagingProvider.ts");
  assert.match(
    providerSource,
    /export async function sendBinaryConfirmPrompt[\s\S]*?if \(provider === "cloud_api"\)[\s\S]*?cloudApiSendReplyButtons[\s\S]*?body: params\.body/,
    "sendBinaryConfirmPrompt should use Cloud interactive buttons and fallback to the same plain text"
  );
  assert.doesNotMatch(
    providerSource,
    /Responde: Si \/ No|Reply: Yes \/ No/,
    "plain-text listing confirmation should not append explicit Si/No instructions"
  );

  const cloudSource = readRepoFile("src/services/cloudApiClient.ts");
  assert.match(
    cloudSource,
    /export async function sendReplyButtons[\s\S]*?type: "interactive"[\s\S]*?confirm_yes[\s\S]*?confirm_no/,
    "Cloud API client should send interactive button replies"
  );
  assert.match(
    cloudSource,
    /else if \(msgType === "interactive"\)[\s\S]*?buttonTitle[\s\S]*?text = buttonTitle/,
    "Cloud API webhook parser should prefer interactive button title for inbound text"
  );

  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /const normalizedText = buttonText \|\| bodyText/,
    "Twilio inbound parsing should prefer visible ButtonText over Body"
  );
});

test("call handoff asks for lead name before transfer and has no-name timeout", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /call_name_confirm[\s\S]*?call_name_collect[\s\S]*?pendingNameConfirmation/,
    "conversation state should include name confirmation states"
  );
  assert.match(
    indexSource,
    /buildCallNamePrompt[\s\S]*?¿me confirmas si tu nombre es/,
    "call flow should ask the user to confirm the captured name"
  );
  assert.match(
    indexSource,
    /scheduleImmediateHttpTask\([\s\S]*?taskPrefix: "call-name-timeout"[\s\S]*?CALL_NAME_TIMEOUT_SECONDS/,
    "call flow should schedule a 3h no-name timeout task"
  );
  assert.match(
    indexSource,
    /export const processCallNameTimeout[\s\S]*?sendCrossOrgCallHandoff\([\s\S]*?useLeadName: false/,
    "timeout handler should transfer with no-name template"
  );
});

test("owner org handoff templates use corrected variables and no-name SIDs", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /const targetAvatarName =[\s\S]*?targetConfig\.assistantAvatarName[\s\S]*?targetConfig\.cloudApiConfig\?\.assistantAvatarName/,
    "handoff should use assistantAvatarName for variable 2"
  );
  assert.match(
    indexSource,
    /const targetOrgName =[\s\S]*?targetConfig\.orgName/,
    "handoff should use orgName for variable 3"
  );
  assert.match(
    indexSource,
    /leadName \? twilioTemplates\.callHandoffOrgEs : twilioTemplates\.callHandoffOrgNoNameEs/,
    "Twilio ES handoff should choose no-name template when lead name is missing"
  );
  assert.match(
    indexSource,
    /"1": leadName,[\s\S]*?"2": targetAvatarName,[\s\S]*?"3": targetOrgName,[\s\S]*?"4": targetListingLink,[\s\S]*?"5": formattedFeatures/,
    "named handoff variables should match the requested template body"
  );
  assert.match(
    indexSource,
    /callHandoffOrgNoNameEs: "HXd9abc59a90371acbd757d290467ec7e5"|callHandoffOrgNoNameEs/,
    "no-name Twilio template key should be represented in code"
  );
});

test("cross-org handoff leaves owner org conversation open for replies", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /await upsertConversation\(state\.chatId,[\s\S]*?isFinished: false[\s\S]*?tags: \["lead", "call", "handoff"\][\s\S]*?flowStep: "qualification"/,
    "owner org conversation should be reopened in qualification after template handoff"
  );
});

test("call listing confirmation does not send pre-confirmation persona intro", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /function buildConfirmListingMessage[\s\S]*?¿Es esta la vivienda por la que nos contactas\?/,
    "listing confirmation should still ask for the property"
  );
  assert.doesNotMatch(
    indexSource,
    /await sendListingResolutionIntroIfNeeded\(callFlowLanguage/,
    "call flow should not introduce an assistant before the listing is confirmed"
  );
});

test("call handoff failures do not fall through into generic AI", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /Call listing resolution flow failed[\s\S]*?sendAlert\("Call handoff flow failed"[\s\S]*?return;/,
    "deterministic call-flow errors should stop instead of continuing into OpenAI"
  );
});

test("cloud api webhook routes by phone number id before shared waba id", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /phoneNumberIndex\/\$\{phoneNumberId\}[\s\S]*?wabaIndex\/\$\{wabaId\}/,
    "whatsappWebhook should prefer phoneNumberIndex before WABA fallback"
  );
  assert.match(
    indexSource,
    /changesByPhoneNumberId[\s\S]*?metadata\?\.phone_number_id[\s\S]*?parseCloudApiWebhook/,
    "whatsappWebhook should group Cloud API changes by metadata.phone_number_id"
  );
});

test("call listing resolution is scoped to call-tagged conversations only", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /if \(\s*\(state\.tags \|\| \[\]\)\.includes\("call"\)\s*&&\s*\(/,
    "listing resolution block should require the call tag"
  );
  assert.doesNotMatch(
    indexSource,
    /state\.listingCode === CALL_PENDING_LISTING_CODE \|\|\s*!state\.listingCode/,
    "missing listingCode alone must not trigger call listing resolution for non-leads"
  );
});

test("in-memory conversation cache is scoped by active org", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /function conversationStateCacheKey\(chatId: string\): string \{\s*return `\$\{getActiveOrgId\(\) \|\| "__no_org__"\}:\$\{chatId\}`;/,
    "conversation cache key should include active org id"
  );
  assert.doesNotMatch(
    indexSource,
    /conversationStates\.(?:get|set)\((?!conversationStateCacheKey)/,
    "conversationStates should only be accessed through org-scoped cache helpers"
  );
});

test("twilio inbound webhook resolves org by destination number before chat lookup", () => {
  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /async function resolveOrgIdByTwilioToNumber\(toRaw: unknown\)/,
    "Twilio inbound routing should have a destination-number resolver"
  );
  assert.match(
    indexSource,
    /const twilioToOrgId = orgId \? undefined : await resolveOrgIdByTwilioToNumber[\s\S]*?if \(!orgId && twilioToOrgId\)[\s\S]*?if \(!orgId\) \{\s*orgId = await findOrgIdByChatId/,
    "webhook should prefer Twilio To org before chatId recency lookup"
  );
});
