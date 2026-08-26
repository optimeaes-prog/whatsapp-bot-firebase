import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("inbound voice flow opens with the language menu and captures DTMF consent", () => {
  const source = readRepoFile("src/index.ts");

  // voiceWebhook: a beat of silence (Twilio clips a <Play> that starts too early), then the
  // bilingual language menu inside a Gather routed to voiceLanguageCallback.
  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?<Pause length="1"\/>[\s\S]*?<Gather numDigits="1"[\s\S]*?<Play>\$\{twimlEscape\(langMenu\)\}<\/Play>/,
    "voiceWebhook should pause, then Play the language menu inside a DTMF gather"
  );
  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?cloudfunctions\.net\/voiceLanguageCallback/,
    "the language gather should route to voiceLanguageCallback"
  );

  // Waiting is the Spanish path: the menu Gather times out and execution falls through to the
  // Spanish consent step in the SAME TwiML document, with no second round-trip to Twilio.
  assert.match(
    source,
    /export const voiceWebhook[\s\S]*?buildConsentGatherTwiml\(\{ language: "es", gatherUrl \}\)/,
    "voiceWebhook should fall through to the Spanish consent step when no digit is pressed"
  );

  // The menu is a single bilingual recording, so there is exactly one URL behind it.
  assert.match(source, /const langMenu = VOICE_AUDIO_LANG_MENU_URL\.value\(\);/, "langMenu from VOICE_AUDIO_LANG_MENU_URL");

  // The consent step plays the opt-in prompt in the chosen language and hands the choice on to
  // voiceGatherCallback, which needs it to pick the matching confirmation locución.
  assert.match(
    source,
    /function buildConsentGatherTwiml[\s\S]*?VOICE_AUDIO_2_OPTIN_EN_URL\.value\(\) : ""\) \|\| VOICE_AUDIO_2_OPTIN_URL\.value\(\)/,
    "the consent prompt should pick the English audio, falling back to Spanish when unset"
  );
  assert.match(
    source,
    /function buildConsentGatherTwiml[\s\S]*?&lang=\$\{params\.language\}/,
    "the consent gather URL should carry the chosen language"
  );

  // voiceGatherCallback: on DTMF 1, record consent + send the template.
  assert.match(
    source,
    /export const voiceGatherCallback[\s\S]*?recordVoiceConsent\([\s\S]*?getVoiceOptInTemplateSid\([\s\S]*?sendInitialTemplateMessage\(/,
    "voiceGatherCallback should record consent and send the opt-in template"
  );
});

test("pressing 1 for English follows the caller into the confirmation and the WhatsApp thread", () => {
  const source = readRepoFile("src/index.ts");

  // Only digit 1 means English. Any other digit continues in Spanish rather than dropping
  // the call, so a mis-key costs the caller nothing.
  assert.match(
    source,
    /export const voiceLanguageCallback[\s\S]*?const language: InboundCallLanguage = digits === "1" \? "en" : "es";/,
    "voiceLanguageCallback should read English from digit 1 and default everything else to Spanish"
  );

  // The choice is stored so the WhatsApp conversation that follows the call speaks the same
  // language — otherwise it is guessed from the phone prefix, which is wrong for an English
  // speaker holding a Spanish number.
  //
  // It is written by voiceGatherCallback, not here: that is the step both branches pass
  // through (pressing 1, and letting the menu time out into Spanish), and it writes whichever
  // language was chosen. Storing only English here left conversations marked English with no
  // way back, because choosing Spanish wrote nothing at all.
  assert.match(
    source,
    /export const voiceGatherCallback[\s\S]*?await upsertConversation\(chatId, \{ language: callLanguage \}\)/,
    "the language chosen on the call should be persisted onto the conversation"
  );
  assert.doesNotMatch(
    source,
    /upsertConversation\(chatId, \{ language: "en" \}\)/,
    "the old English-only write must be gone, or Spanish can never win it back"
  );

  // Signature verification must match the other two voice endpoints, including the subaccount
  // fallback — a per-org voice number signs with its own auth token.
  assert.match(
    source,
    /export const voiceLanguageCallback[\s\S]*?verifyTwilioSignature\(TWILIO_AUTH_TOKEN\.value\(\)[\s\S]*?getOrgTwilioAuthToken\(queryOrgId\)/,
    "voiceLanguageCallback should verify the Twilio signature with the master then subaccount token"
  );

  // The confirmation locución follows the language chosen at the menu.
  assert.match(
    source,
    /export const voiceGatherCallback[\s\S]*?const callLanguage = parseInboundCallLanguage\(req\.query\.lang\);[\s\S]*?VOICE_AUDIO_3_EN_URL\.value\(\) : ""\) \|\| VOICE_AUDIO_3_URL\.value\(\)/,
    "voiceGatherCallback should play the confirmation in the language carried on the gather URL"
  );
});

test("each language uses its own approved ElevenLabs voice", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /const OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT = "7QQzpAyzlKTVrRzQJmTE";/,
    "approved Spanish voiceId constant should exist"
  );

  // The one-off generation script that produces the inbound MP3s locks each language to its
  // approved voice, so no Spanish line is ever read by the English voice or the other way round.
  const genScript = readRepoFile("src/scripts/generateInboundVoice.ts");
  assert.match(
    genScript,
    /const VOICE_ID_ES = "7QQzpAyzlKTVrRzQJmTE";/,
    "generation script should lock Spanish to the approved voiceId"
  );
  assert.match(
    genScript,
    /const VOICE_ID_EN = "u8GDilEiJPUbRk87Lcqs";/,
    "generation script should lock English to the approved voiceId"
  );
  assert.match(
    genScript,
    /message_part_1_menu\.mp3[\s\S]*?message_part_2_optin\.mp3[\s\S]*?message_part_2_optin_en\.mp3[\s\S]*?message_part_3\.mp3[\s\S]*?message_part_3_en\.mp3/,
    "generation script should know every inbound locución"
  );

  // The approved recordings were tuned by ear in the ElevenLabs UI. A plain run must leave
  // them alone, or it would silently swap the audio callers hear for a different take.
  assert.match(
    genScript,
    /LOCUCIONES\.filter\(\(l\) => !l\.handMade\)/,
    "a run without --only should skip the hand-made locuciones"
  );
});
