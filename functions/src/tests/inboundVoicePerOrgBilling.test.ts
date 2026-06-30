import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

test("per-org opt-in is charged exactly once and is distinct from the legacy handoff double-charge", () => {
  const src = readRepoFile("src/index.ts");

  // The per-org opt-in send deducts one credit with its own description, in exactly one place.
  const perOrgLabel = '"Inbound voice opt-in (per-org)"';
  const occurrences = src.split(perOrgLabel).length - 1;
  assert.equal(occurrences, 1, "per-org opt-in deduction should appear in exactly one place");

  // It reuses the `initialOutboundCreditsDeducted` idempotency key (NOT the handoff intake key).
  assert.match(
    src,
    /deductOrgConversationOnce\([\s\S]*?"initialOutboundCreditsDeducted",[\s\S]*?"Inbound voice opt-in \(per-org\)"/,
    "per-org opt-in should use the initialOutboundCreditsDeducted key"
  );

  // The legacy handoff double-charge (intake + initial) stays intact for the flag-off path.
  assert.match(src, /intakeOutboundCreditsDeducted/, "legacy handoff intake charge must remain");
  assert.match(src, /chargeDestinationOrgForHandoff/, "legacy handoff billing helper must remain");
});
