import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { mapFriendlyNameToSlot } from "../services/twilioMigrationTypes";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

/**
 * Quien llama desde un número que no es español recibe el primer mensaje en
 * inglés. Antes ese envío daba por hecho el castellano y solo se traducía el
 * resto de la conversación.
 */
test("the post-call template is chosen with the caller's language", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /const optInLanguage = resolveInitialLanguage\(phone\);/,
    "the language must come from the phone, like the rest of the call flow"
  );
  assert.match(
    src,
    /const templateSid = await getVoiceOptInTemplateSid\(orgId, optInLanguage\);/,
    "the template has to be picked with that language"
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
