import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  mapFriendlyNameToSlot,
  REQUIRED_TWILIO_TEMPLATE_SLOTS,
  TWILIO_MIGRATION_JOBS_COLLECTION,
  TWILIO_MIGRATION_MAX_AGE_MS,
} from "../services/twilioMigrationTypes";
import {
  normalizeWhatsAppTemplateName,
  twilioTemplateDedupeKey,
} from "../services/twilioClient";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

// ==================== pure mapping helpers ====================

test("mapFriendlyNameToSlot: idealista_confirm_es with timestamp → idealistaInitialEs", () => {
  assert.equal(mapFriendlyNameToSlot("idealista_confirm_es_1734567890"), "idealistaInitialEs");
});

test("mapFriendlyNameToSlot: call_handoff_org_no_name_en → callHandoffOrgNoNameEn", () => {
  assert.equal(
    mapFriendlyNameToSlot("call_handoff_org_no_name_en_42"),
    "callHandoffOrgNoNameEn"
  );
});

test("mapFriendlyNameToSlot: prefers 8var prefix over generic agent_notification", () => {
  assert.equal(mapFriendlyNameToSlot("agent_notification_8var_42"), "agentNotification");
  assert.equal(
    mapFriendlyNameToSlot("agent_notification_legacy_42"),
    "agentNotificationLegacy"
  );
  assert.equal(mapFriendlyNameToSlot("agent_notification_42"), "agentNotification");
});

test("mapFriendlyNameToSlot: unknown name → undefined", () => {
  assert.equal(mapFriendlyNameToSlot("some_random_thing"), undefined);
  assert.equal(mapFriendlyNameToSlot(""), undefined);
});

test("mapFriendlyNameToSlot: case-insensitive", () => {
  assert.equal(mapFriendlyNameToSlot("Voice_OptIn_Consent_ES_99"), "voiceOptInConsent");
});

// ==================== template name + dedupe helpers ====================

test("normalizeWhatsAppTemplateName: lowercases and snake_cases", () => {
  assert.equal(normalizeWhatsAppTemplateName("Call Handoff Org ES (v2)"), "call_handoff_org_es_v2");
});

test("normalizeWhatsAppTemplateName: trims leading/trailing underscores", () => {
  assert.equal(normalizeWhatsAppTemplateName("__weird-name!!"), "weird_name");
});

test("twilioTemplateDedupeKey: stable key for friendly_name + language", () => {
  assert.equal(
    twilioTemplateDedupeKey({ friendly_name: "Foo", language: "ES" }),
    twilioTemplateDedupeKey({ friendly_name: "foo", language: "es" })
  );
});

// ==================== migration-types invariants ====================

test("REQUIRED_TWILIO_TEMPLATE_SLOTS includes the runtime-critical slots", () => {
  // These are the slots without which the call flow / qualification flow breaks.
  for (const slot of ["idealistaInitialEs", "callHandoffOrgEs", "voiceOptInConsent"]) {
    assert.ok(
      REQUIRED_TWILIO_TEMPLATE_SLOTS.includes(slot as never),
      `required slot ${slot} should be tracked`
    );
  }
});

test("TWILIO_MIGRATION_MAX_AGE_MS is reasonable (>= 24h, <= 1 week)", () => {
  assert.ok(TWILIO_MIGRATION_MAX_AGE_MS >= 24 * 60 * 60 * 1000);
  assert.ok(TWILIO_MIGRATION_MAX_AGE_MS <= 7 * 24 * 60 * 60 * 1000);
});

test("Migration collection name matches the value used in firestore.rules", () => {
  const rules = readRepoFile("../firestore.rules");
  assert.match(
    rules,
    new RegExp(`match /${TWILIO_MIGRATION_JOBS_COLLECTION}/`),
    "firestore.rules must scope the same collection name used by the backend service"
  );
});

// ==================== source contracts (regression guards) ====================

test("submitContentForWhatsAppApproval always hardcodes MARKETING (project policy)", () => {
  const source = readRepoFile("src/services/twilioClient.ts");
  // The body sent to ApprovalRequests/whatsapp must declare a MARKETING category literal,
  // never UTILITY or AUTHENTICATION. See memory/project_whatsapp_template_category.md.
  assert.match(
    source,
    /category:\s*"MARKETING"\s+as\s+const/,
    "submitContentForWhatsAppApproval body must include `category: \"MARKETING\" as const`"
  );
  assert.doesNotMatch(
    source,
    /category:\s*"(UTILITY|AUTHENTICATION)"/,
    "no UTILITY/AUTHENTICATION literals should leak in"
  );
});

test("startMigration writes target botConfig before clone loop (so freeform works immediately)", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  const writeIdx = source.indexOf("messagingProvider: \"twilio\"");
  const cloneIdx = source.indexOf("Clone + submit each snapshotted source template");
  assert.ok(writeIdx > 0, "expected botConfig write block in startMigration");
  assert.ok(cloneIdx > 0, "expected source template clone-and-submit step");
  assert.ok(
    writeIdx < cloneIdx,
    "twilioConfig write must happen before template clone to avoid leaving org in broken state"
  );
});

test("startMigration reuses an existing in-flight job for the same target org (idempotent)", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  assert.match(
    source,
    /\.where\("targetOrgId", "==", targetOrgId\)[\s\S]*?\.where\("status", "in", \["pending", "templates_submitted", "awaiting_approval"\]\)/,
    "startMigration must query for an existing in-flight job before creating a new one"
  );
});

test("startMigration skips template creation when friendly_name::language already exists in destination", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  assert.match(
    source,
    /newAccountByKey\.get\(key\)/,
    "dedupe map lookup must short-circuit createContentTemplateWithCreds"
  );
});

test("startMigration skips approval submission when one already exists on the SID", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  assert.match(
    source,
    /fetchContentApprovalStatus\(newCreds, newSid\)/,
    "must check for an existing ApprovalRequest before submitting"
  );
});

test("applyApprovedTemplatesToOrg overwrites stale slot values (same-source-as-target case)", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  // The previous "never clobber" guard was incorrect for migrations: when an org
  // is repointing to a new Twilio account, its existing slot values are SIDs
  // from the OLD account and are useless on the NEW account. We must overwrite
  // them. The only optimization is to skip a redundant write when the slot is
  // already exactly the new SID.
  assert.match(
    source,
    /if \(existingSlots\[state\.mappedSlot\] === state\.newSid\) continue;/,
    "should skip only when slot already equals the new SID (idempotent), not when it differs"
  );
  assert.doesNotMatch(
    source,
    /if \(existingSlots\[state\.mappedSlot\]\) continue;/,
    "must not bail out just because the slot is populated"
  );
});

test("Job completion requires THIS job's approvals (stale pre-existing SIDs don't count)", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  // Previously the code unioned `Object.keys(existingSlots)` into the filled-set,
  // which would mark a same-source-as-target migration as complete before any
  // approval had actually landed. Completion must be driven by job.templates only.
  assert.match(
    source,
    /filledByThisJob[\s\S]*?state\.approvalStatus === "approved"[\s\S]*?filledByThisJob\.add\(state\.mappedSlot\)/,
    "completion must be driven by approved templates in this job, not pre-existing slot values"
  );
});

test("Source templates are snapshotted into the job doc before the secret rotation", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  const snapshotIdx = source.indexOf("snapshotSourceTemplatesIfMissing(jobRef, sourceOrgId)");
  const rotateIdx = source.indexOf("upsertAuthTokenSecret(targetOrgId, newAuthToken)");
  assert.ok(snapshotIdx > 0, "snapshotSourceTemplatesIfMissing must be invoked");
  assert.ok(rotateIdx > 0, "upsertAuthTokenSecret must be invoked");
  assert.ok(
    snapshotIdx < rotateIdx,
    "snapshot must happen before secret rotation so same-source-as-target resumes work"
  );
});

test("snapshotSourceTemplatesIfMissing persists sourceVariables + sourceTypes for resumes", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  assert.match(
    source,
    /sourceVariables:\s*src\.variables[\s\S]*?sourceTypes:\s*src\.types/,
    "snapshot must persist enough of the source template to recreate it on resume"
  );
});

test("Same-source-as-target is not blocked", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  // Defensive: no validation should reject when source == target.
  assert.doesNotMatch(
    source,
    /source.*target.*must be different/i,
    "must not throw 'source/target must differ' style errors"
  );
  // Positive: the `sameOrg` flag is computed (so the code is aware of this case).
  assert.match(
    source,
    /const sameOrg = sourceOrgId === targetOrgId;/,
    "should compute a sameOrg flag for diagnostics"
  );
  const fe = readRepoFile("../src/pages/AdminTwilioMigration.tsx");
  assert.doesNotMatch(
    fe,
    /targetOrgId\s*!==\s*sourceOrgId/,
    "UI's canStart must not require source != target"
  );
});

test("startMigration sets agentNotificationIs8Var=true when an 8-var template is cloned", () => {
  const source = readRepoFile("src/services/twilioMigration.ts");
  assert.match(
    source,
    /any8Var \? \{ agentNotificationIs8Var: true \}/,
    "applyApprovedTemplatesToOrg should set the per-org 8-var flag when present"
  );
  // The 8-var detection regex literal must exist in the source (we search for
  // the literal regex form, escaping the character class brackets).
  assert.match(
    source,
    /agent\[_-]\?notification\[_-]\?8var/i,
    "8-var detection regex /agent[_-]?notification[_-]?8var/i should appear in source"
  );
});

test("scheduled poller runs at 10 minute interval (per plan)", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /pollPendingTwilioMigrations[\s\S]*?schedule:\s*"every 10 minutes"/,
    "the scheduled poller must run every 10 minutes"
  );
});

test("HTTP endpoints require admin or super_admin role", () => {
  const source = readRepoFile("src/index.ts");
  // Each of the three endpoints calls isAdminRole and 403s otherwise.
  for (const endpoint of [
    "startTwilioSenderMigration",
    "pollTwilioMigrationJob",
    "retryTwilioMigrationStep",
  ]) {
    const blockStart = source.indexOf(`export const ${endpoint} = onRequest`);
    assert.ok(blockStart >= 0, `${endpoint} should be exported`);
    const block = source.slice(blockStart, blockStart + 2000);
    assert.match(block, /isAdminRole\(role\)/, `${endpoint} must check isAdminRole`);
    assert.match(block, /Forbidden/, `${endpoint} must return 403 when not admin`);
  }
});

test("Firestore rules deny client writes to twilioMigrationJobs", () => {
  const rules = readRepoFile("../firestore.rules");
  const block = rules.slice(rules.indexOf("twilioMigrationJobs"));
  assert.match(block, /allow write:\s*if false/, "client writes must be denied");
  assert.match(
    block,
    /allow read:[^;]*isSuperAdmin\(\)[^;]*getRole\(\)\s*==\s*"admin"/,
    "reads scoped to admin or super_admin"
  );
});
