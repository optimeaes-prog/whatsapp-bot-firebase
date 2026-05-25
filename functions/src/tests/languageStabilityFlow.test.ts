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

test("index exposes reply language inference for qualification buffering", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /export function resolveReplyLanguageFromMessages/,
    "index should export resolveReplyLanguageFromMessages for tests and tooling"
  );
  assert.match(
    source,
    /Prefer visible button label so language inference matches the template locale/,
    "Twilio ingress should document locale-safe ButtonText handling"
  );
});

test("assistant replies still parse qualification markers from raw model output", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /rawAssistantReply = await generateAssistantResponse\([\s\S]*?const \{ cleanMessage, qualificationStatus \} = parseAssistantResponse\(rawAssistantReply\)/,
    "response pipeline should parse qualification status from assistant output"
  );
});
