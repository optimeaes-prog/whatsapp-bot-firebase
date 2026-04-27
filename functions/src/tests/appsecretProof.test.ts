import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("cloudApiClient Graph requests include appsecret_proof", () => {
  const source = readRepoFile("src/services/cloudApiClient.ts");

  const expectations: Array<{ label: string; pattern: RegExp }> = [
    {
      label: "sendText includes appsecret_proof in axios config params",
      pattern: /export async function sendText[\s\S]*?axios\.post\([\s\S]*?params:\s*\{[\s\S]*?appsecret_proof:\s*appSecretProof[\s\S]*?\}/,
    },
    {
      label: "sendTemplate includes appsecret_proof in axios config params",
      pattern: /export async function sendTemplate[\s\S]*?axios\.post\([\s\S]*?params:\s*\{[\s\S]*?appsecret_proof:\s*appSecretProof[\s\S]*?\}/,
    },
    {
      label: "createMessageTemplate includes appsecret_proof in axios config params",
      pattern: /export async function createMessageTemplate[\s\S]*?axios\.post\([\s\S]*?params:\s*\{[\s\S]*?appsecret_proof:\s*appSecretProof[\s\S]*?\}/,
    },
    {
      label: "checkCloudApiHealth includes appsecret_proof in axios config params",
      pattern: /export async function checkCloudApiHealth[\s\S]*?axios\.get\([\s\S]*?params:\s*\{[\s\S]*?appsecret_proof:\s*appSecretProof[\s\S]*?\}/,
    },
  ];

  for (const expectation of expectations) {
    assert.match(source, expectation.pattern, expectation.label);
  }
});

test("index deleteMyOrganization includes appsecret_proof on subscribed_apps delete", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /deleteMyOrganization[\s\S]*?axios[\s\S]*?\.delete\([\s\S]*?subscribed_apps[\s\S]*?params:\s*\{\s*appsecret_proof:\s*creds\.appSecretProof\s*\}/,
    "deleteMyOrganization should pass appsecret_proof when deleting subscribed_apps"
  );
});
