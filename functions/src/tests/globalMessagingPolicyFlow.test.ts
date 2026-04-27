import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("provider resolution uses org override then global default", () => {
  const source = readRepoFile("src/services/messagingProvider.ts");
  assert.match(
    source,
    /const orgProvider = await getOrganizationMessagingProvider\(orgId\);[\s\S]*?if \(orgProvider\)[\s\S]*?source: "org"/,
    "messagingProvider should prefer org-level provider override"
  );
  assert.match(
    source,
    /const globalPolicy = await getGlobalMessagingPolicy\(\);[\s\S]*?defaultProvider[\s\S]*?source: "global"/,
    "messagingProvider should fallback to global default provider"
  );
});

test("cloud api credentials merge global templates with org templates", () => {
  const source = readRepoFile("src/services/cloudApiClient.ts");
  assert.match(
    source,
    /const globalPolicy = await getGlobalMessagingPolicy\(\);[\s\S]*?const mergedTemplates:[\s\S]*?\{\s*\.\.\.globalTemplates,[\s\S]*?\.\.\.\(config\.templates \|\| \{\}\)/,
    "cloudApi credentials should use global templates with org override precedence"
  );
});

test("global policy endpoints and migration seed exist", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(source, /export const getGlobalMessagingPolicyConfig = onRequest/, "get endpoint should exist");
  assert.match(source, /export const setGlobalMessagingPolicyConfig = onRequest/, "set endpoint should exist");
  assert.match(source, /export const setPlatformDefaultProviderConfig = onRequest/, "default provider endpoint should exist");
  assert.match(source, /export const clearOrgMessagingProviderOverride = onRequest/, "clear org override endpoint should exist");
  assert.match(source, /export const seedGlobalMessagingPolicy = onRequest/, "migration seed endpoint should exist");
});

test("call handoff readiness exposes effective provider source", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /const providerResolution = await getEffectiveProviderForOrg\(targetOrgId\);[\s\S]*?providerSource: providerResolution\.source/,
    "readiness endpoint should report effective provider source"
  );
});
