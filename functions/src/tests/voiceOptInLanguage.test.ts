import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { mapFriendlyNameToSlot } from "../services/twilioMigrationTypes";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

/**
 * El primer mensaje sale en el idioma de la llamada. Antes este envío daba por
 * hecho el castellano, y quien llamaba desde fuera abría con un mensaje que
 * quizá no entendía.
 */
test("the post-call send follows the language decided during the call", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /language: callLanguage,/,
    "the send must carry the call's language"
  );
  assert.doesNotMatch(
    src,
    /await recordVoiceConsent\(\{ phone, chatId, callSid \}\);[\s\S]{0,600}?language: "es",/,
    "the opt-in send must not hardcode Spanish any more"
  );
});

test("an agency without an English template still gets the Spanish one", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /const englishSid = language === "en" \? \(twilioTemplates\.voiceOptInConsentEn \|\| ""\)\.trim\(\) : "";/,
    "English is only used when that slot is filled"
  );
  assert.match(
    src,
    /const sid = englishSid \|\| twilioTemplates\.voiceOptInConsent \|\|/,
    "with no English template it must fall back to Spanish, not fail"
  );
});

/**
 * El nombre decide en qué hueco de la configuración cae la plantilla cuando se
 * migra una agencia de cuenta de Twilio. Los prefijos se comparan con
 * startsWith, así que el inglés tiene que ganar al genérico.
 */
test("an English template name maps to the English slot, not the Spanish one", () => {
  assert.equal(
    mapFriendlyNameToSlot("voice_optin_consent_en_catalogo_20260826"),
    "voiceOptInConsentEn"
  );
  assert.equal(
    mapFriendlyNameToSlot("voice_optin_consent_es_catalogo_20260817"),
    "voiceOptInConsent"
  );
  // Sin sufijo de idioma se queda en el castellano, que es como se llamaban las
  // plantillas antiguas.
  assert.equal(mapFriendlyNameToSlot("voice_optin_consent_es_99"), "voiceOptInConsent");
});

test("the legacy intake send keeps its Spanish template", () => {
  const src = readRepoFile("src/index.ts");
  // sendCallHandoffMessage llama sin idioma: la organización de intake solo
  // tiene plantilla en castellano y no sabe aún de qué agencia es el lead.
  assert.match(
    src,
    /const templateSid = await getVoiceOptInTemplateSid\(orgId\);\n\s+await sendInitialTemplateMessage\(\{/,
    "the intake path must keep calling without a language"
  );
});

/**
 * Lo que el caller elige en la llamada vale para esa llamada y para el chat: si
 * pulsa 1 recibe la plantilla (y por tanto el catálogo) en inglés, y si deja que
 * salte el castellano recibe la castellana. Y como se guarda en los dos idiomas,
 * la siguiente llamada vuelve a decidir desde cero.
 */
test("the caller's choice during the call decides the language, not the phone prefix", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /const callLanguage = parseInboundCallLanguage\(req\.query\.lang\);/,
    "the consent step must read the choice carried on the gather URL"
  );
  assert.match(
    src,
    /const templateSid = await getVoiceOptInTemplateSid\(orgId, callLanguage\);/,
    "the template must follow that choice"
  );
  assert.doesNotMatch(
    src,
    /const optInLanguage = resolveInitialLanguage\(phone\);/,
    "the phone prefix must no longer override a deliberate keypress"
  );
});

test("the choice is stored in both languages, so a later call can choose again", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /await upsertConversation\(chatId, \{ language: callLanguage \}\);/,
    "the language has to be written whichever one was chosen"
  );
  // La escritura de un solo sentido del menú era la que dejaba conversaciones
  // marcadas en inglés para siempre.
  assert.doesNotMatch(
    src,
    /await upsertConversation\(chatId, \{ language: "en" \}\);/,
    "the English-only write must be gone"
  );
});

test("a message with no letters never changes the language", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /const carriesLanguageSignal = sortedMessages\.some\(\(m\) => \/\[a-záéíóúñü\]\/i\.test\(m\.text \|\| ""\)\);/,
    "there must be a check for any letter at all"
  );
  assert.match(
    src,
    /if \(carriesLanguageSignal\) \{[\s\S]*?resolveReplyLanguageWithAgent\(/,
    "the router may only run when the message actually carries words"
  );
});
