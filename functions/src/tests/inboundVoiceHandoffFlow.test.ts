import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("inbound voice handoff uses speech-name gather then DTMF consent gather", () => {
  const source = readRepoFile("src/index.ts");

  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?<Gather input="speech"/,
    "voiceWebhook should gather speech"
  );

  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?cloudfunctions\.net\/voiceNameCallback/,
    "voiceWebhook should route to voiceNameCallback URL"
  );

  assert.match(
    source,
    /export const voiceNameCallback[\s\S]*?<Gather numDigits="1"/,
    "voiceNameCallback should gather DTMF 1"
  );

  assert.match(
    source,
    /export const voiceNameCallback[\s\S]*?cloudfunctions\.net\/voiceGatherCallback/,
    "voiceNameCallback should route to voiceGatherCallback URL"
  );

  assert.match(
    source,
    /export const voiceGatherCallback[\s\S]*?const provider = await getActiveProviderFn\(\);[\s\S]*?if \(provider === "twilio"\)[\s\S]*?sendInitialTemplateMessage\([\s\S]*?templateSid[\s\S]*?if \(provider === "cloud_api"\)[\s\S]*?templateName/,
    "voiceGatherCallback should branch by provider and send a template accordingly"
  );

  assert.match(
    source,
    /SpeechResult/,
    "voiceNameCallback should read SpeechResult from Twilio"
  );
  assert.match(
    source,
    /speechTimeout="1"/,
    "speech gather should use a short timeout to reduce post-name silence"
  );
  assert.match(
    source,
    /export const voiceNameCallback = onRequest\([\s\S]*?secrets: \[ELEVENLABS_KEY\][\s\S]*?minInstances: 1/,
    "voiceNameCallback should declare ELEVENLABS_KEY and stay warm for ElevenLabs opt-in audio"
  );
  assert.match(
    source,
    /ensureInboundStaticAudioPublicUrl\(effectiveLanguage, "opt_in_first"\)[\s\S]*ensureInboundStaticAudioPublicUrl\(effectiveLanguage, "opt_in_repeat"\)/,
    "voiceNameCallback should use ElevenLabs static audio for opt-in and repeat prompts"
  );
});

test("inbound static audio reuses outbound approved ElevenLabs voiceId", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /export const voiceWebhook = onRequest\([\s\S]*?secrets: \[ELEVENLABS_KEY\][\s\S]*?minInstances: 1/,
    "voiceWebhook should declare ELEVENLABS_KEY and stay warm"
  );
  assert.match(
    source,
    /const audioUrl = await ensureInboundStaticAudioPublicUrl\(locale\.language, "name"\);/,
    "voiceWebhook should wait for static inbound audio URL before responding"
  );
  assert.match(
    source,
    /await file\.getSignedUrl\(\{[\s\S]*?version: "v4"[\s\S]*?action: "read"[\s\S]*?7 \* 24 \* 60 \* 60 \* 1000/,
    "inbound audio should use the same private Storage signed URL pattern as outbound"
  );
  assert.match(
    source,
    /const OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT = "7QQzpAyzlKTVrRzQJmTE";/,
    "approved voiceId constant should exist"
  );
  assert.match(
    source,
    /const voiceId = OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT; \/\/ locked to outbound approved voice/,
    "inbound audio generation should lock voiceId to outbound constant"
  );
});

