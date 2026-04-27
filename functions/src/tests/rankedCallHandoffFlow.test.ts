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
    /export async function sendBinaryConfirmPrompt[\s\S]*?if \(provider === "cloud_api"\)[\s\S]*?cloudApiSendReplyButtons[\s\S]*?fallbackBody/,
    "sendBinaryConfirmPrompt should use Cloud interactive buttons and fallback to text"
  );

  const cloudSource = readRepoFile("src/services/cloudApiClient.ts");
  assert.match(
    cloudSource,
    /export async function sendReplyButtons[\s\S]*?type: "interactive"[\s\S]*?confirm_yes[\s\S]*?confirm_no/,
    "Cloud API client should send interactive button replies"
  );
  assert.match(
    cloudSource,
    /else if \(msgType === "interactive"\)[\s\S]*?button_reply[\s\S]*?confirm_yes[\s\S]*?confirm_no/,
    "Cloud API webhook parser should normalize interactive replies"
  );

  const indexSource = readRepoFile("src/index.ts");
  assert.match(
    indexSource,
    /ButtonPayload[\s\S]*?confirm_yes[\s\S]*?confirm_no/,
    "Twilio inbound parsing should normalize button payloads"
  );
});
