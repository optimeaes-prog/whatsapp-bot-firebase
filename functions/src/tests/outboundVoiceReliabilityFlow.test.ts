import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("outbound audio uses dedicated bucket param and preflight guard", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /const OUTBOUND_AUDIO_BUCKET = defineString\("OUTBOUND_AUDIO_BUCKET"\);/,
    "OUTBOUND_AUDIO_BUCKET param should be defined"
  );
  assert.match(
    source,
    /const OUTBOUND_AUDIO_BUCKET_DEFAULT = "real-estate-idealista-bot-outbound-voice";/,
    "default dedicated bucket should be declared"
  );
  assert.match(
    source,
    /await assertOutboundAudioBucketWritable\(bucketName\);/,
    "newLead flow should preflight bucket access"
  );
});

test("outbound audio generation retries twice and marks terminal failure", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /const OUTBOUND_AUDIO_MAX_GENERATION_ATTEMPTS = 2;/,
    "retry attempts should be capped at 2"
  );
  assert.match(
    source,
    /for \(let attempt = 1; attempt <= OUTBOUND_AUDIO_MAX_GENERATION_ATTEMPTS; attempt \+= 1\)/,
    "audio generation should run bounded retries"
  );
  assert.match(
    source,
    /status: audioUrl \? "ready" : "failed_after_retries"/,
    "conversation state should encode terminal audio failure"
  );
});

test("Twilio voice fallback only on terminal ElevenLabs failure status", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /audioStatus === "failed_after_retries"/,
    "voice webhook should only fallback when terminal failure status is set"
  );
  assert.match(
    source,
    /fallback_used: !audioUrl && audioStatus === "failed_after_retries"/,
    "logs should explicitly report fallback usage"
  );
});
