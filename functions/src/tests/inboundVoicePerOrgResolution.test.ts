import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

test("resolveOrgIdByVoiceNumber is index-first with a linear-scan fallback", () => {
  const src = readRepoFile("src/services/inboundVoicePerOrg.ts");
  assert.match(src, /export async function resolveOrgIdByVoiceNumber/);
  // 1) O(1) index read by normalized key.
  assert.match(src, /voiceNumberIndex\/\$\{key\}/, "should read the voiceNumberIndex doc by normalized key");
  // The index hit is validated against the org's current config to reject stale mappings.
  assert.match(src, /normalizeVoiceE164\(cfg\.twilioConfig\?\.voiceNumber\) === key/, "should validate the index hit");
  // 2) Scan fallback over all orgs comparing the dedicated voice number.
  assert.match(src, /collection\("organizations"\)/, "should scan organizations as a fallback");
  assert.match(src, /normalizeVoiceE164\(cfg\?\.twilioConfig\?\.voiceNumber\) === key/, "scan compares twilioConfig.voiceNumber");
});

test("normalizeVoiceE164 strips + and the whatsapp: prefix", () => {
  const src = readRepoFile("src/services/inboundVoicePerOrg.ts");
  assert.match(src, /export function normalizeVoiceE164/);
  assert.match(src, /replace\(\/\^whatsapp:\/,/, "should strip a whatsapp: prefix");
  assert.match(src, /replace\(\/\\D\/g, ""\)/, "should keep digits only");
});
