import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("openai client separates qualification prompt and language policy", () => {
  const source = readRepoFile("src/services/openaiClient.ts");
  assert.match(
    source,
    /function buildLanguagePolicyPrompt[\s\S]*?LANGUAGE POLICY \(STRICT\)[\s\S]*?POLÍTICA DE IDIOMA \(ESTRICTA\)/,
    "openaiClient should define a dedicated language policy prompt"
  );
  assert.match(
    source,
    /function buildQualificationPrompt[\s\S]*?function buildInstructions[\s\S]*?qualificationPrompt[\s\S]*?languagePolicyPrompt/,
    "openaiClient should compose qualification rules and language policy independently"
  );
});

test("index keeps language lock state and ignores neutral quick replies", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /LANGUAGE_NEUTRAL_TOKENS[\s\S]*?confirm_yes[\s\S]*?confirm_no/,
    "index should treat confirm buttons as language-neutral"
  );
  assert.match(
    source,
    /if \(isLanguageNeutralReply\(text\)\) continue;/,
    "language inference should skip neutral quick replies"
  );
  assert.match(
    source,
    /state\.targetLanguage = inferredLanguage;[\s\S]*?state\.languageLockSource = "user_confirmed"/,
    "process flow should lock outbound language from user-confirmed evidence"
  );
  assert.match(
    source,
    /const isCallDeterministicStep =[\s\S]*?state\.flowStep === "call_listing_collect"[\s\S]*?const inferredLanguage = isCallDeterministicStep[\s\S]*?\? fallbackLanguage/,
    "call listing/name deterministic steps should not relock language from short listing hints"
  );
});

test("outbound guardrail is feature-flagged and preserves qualification parsing", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(source, /const LANGUAGE_GUARDRAIL_ENABLED = defineString\("LANGUAGE_GUARDRAIL_ENABLED"\);/);
  assert.match(source, /const LANGUAGE_GUARDRAIL_DRY_RUN = defineString\("LANGUAGE_GUARDRAIL_DRY_RUN"\);/);
  assert.match(
    source,
    /if \(shouldEnableLanguageGuardrail\(\)\)[\s\S]*?enforceOutboundLanguage\(/,
    "guardrail should run only when enabled"
  );
  assert.match(
    source,
    /const \{ cleanMessage, qualificationStatus \} = parseAssistantResponse\(guardedReply\);/,
    "qualification parsing should remain in place after guardrail processing"
  );
});
