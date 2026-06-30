import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

test("call gate scopes the listing search to the org for per-org calls", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(src, /const isPerOrgCall = state\.callFlowMode === "per_org";/);
  assert.match(
    src,
    /includeAllOrgs: \(state\.tags \|\| \[\]\)\.includes\("call"\) && !isPerOrgCall/,
    "per-org calls must search only the resolved org's listings"
  );
});

test("applyListingToStateAndPersist treats per-org calls as non-handoff and sends the in-place found message", () => {
  const src = readRepoFile("src/index.ts");
  // Per-org calls are excluded from the handoff predicate (the `|| includes('call')` term).
  assert.match(
    src,
    /const isCrossOrgCallHandoff = !isPerOrgCall && \(targetOrgId !== sourceOrgId \|\| \(state\.tags \|\| \[\]\)\.includes\("call"\)\)/,
    "per-org calls must bypass the cross-org handoff path"
  );
  // The non-handoff branch sends the dedicated "found it" continuation for per-org calls.
  assert.match(
    src,
    /isPerOrgCall[\s\S]*?composeListingFoundMessage\(\{[\s\S]*?flowStep: "qualification"/,
    "per-org branch should send composeListingFoundMessage then enter qualification"
  );
});
