import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("inbound voice flow plays the three locuciones via <Play> and captures DTMF consent", () => {
  const source = readRepoFile("src/index.ts");

  // voiceWebhook: Play greeting (audio1) → DTMF gather containing the opt-in prompt (audio2).
  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?<Play>\$\{twimlEscape\(audio1\)\}<\/Play>[\s\S]*?<Gather numDigits="1"[\s\S]*?<Play>\$\{twimlEscape\(audio2\)\}<\/Play>/,
    "voiceWebhook should Play audio1 (greeting) then Play audio2 (opt-in) inside a DTMF gather"
  );
  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?cloudfunctions\.net\/voiceGatherCallback/,
    "voiceWebhook gather should route to voiceGatherCallback"
  );

  // The three locuciones come from the three configured audio URLs.
  assert.match(source, /const audio1 = VOICE_AUDIO_1_URL\.value\(\);/, "audio1 from VOICE_AUDIO_1_URL");
  assert.match(source, /const audio2 = VOICE_AUDIO_2_OPTIN_URL\.value\(\);/, "audio2 from VOICE_AUDIO_2_OPTIN_URL");
  assert.match(
    source,
    /const VOICE_AUDIO_3_URL = defineString\("VOICE_AUDIO_3_URL"\);/,
    "VOICE_AUDIO_3_URL param should be defined"
  );

  // voiceGatherCallback: on DTMF 1, record consent + send the template, then Play the
  // confirmation locución (#3) — same voice as the others, NOT the old Polly <Say>.
  assert.match(
    source,
    /export const voiceGatherCallback[\s\S]*?recordVoiceConsent\([\s\S]*?getVoiceOptInTemplateSid\([\s\S]*?sendInitialTemplateMessage\(/,
    "voiceGatherCallback should record consent and send the opt-in template"
  );
  assert.match(
    source,
    /export const voiceGatherCallback[\s\S]*?const audio3 = VOICE_AUDIO_3_URL\.value\(\);[\s\S]*?<Play>\$\{twimlEscape\(audio3\)\}<\/Play>/,
    "voiceGatherCallback should Play the VOICE_AUDIO_3_URL confirmation locución"
  );
});

test("all inbound locuciones use the approved ElevenLabs voice", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /const OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT = "7QQzpAyzlKTVrRzQJmTE";/,
    "approved voiceId constant should exist"
  );

  // The one-off generation script that produces the inbound MP3s must lock to the approved
  // voice and produce all three locuciones, so the whole inbound call is one consistent voice.
  const genScript = readRepoFile("src/scripts/generateInboundVoice.ts");
  assert.match(
    genScript,
    /const VOICE_ID = "7QQzpAyzlKTVrRzQJmTE";/,
    "inbound voice generation script should lock to the approved voiceId"
  );
  assert.match(
    genScript,
    /message_part_1\.mp3[\s\S]*?message_part_2_optin\.mp3[\s\S]*?message_part_3\.mp3/,
    "generation script should produce all three inbound locuciones"
  );
});
