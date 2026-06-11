import * as admin from "firebase-admin";
import { getFirestore, FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { splitNotificationNumberRaw } from "../services/qualifiedLeadNotificationTargets";
import {
  digestsFromE164,
  normalizeToE164,
  type NotificationNumberSource,
} from "../services/notificationNumbersService";

// One-off backfill: migrates the legacy per-org and per-agent phone fields into
// the new `organizations/{orgId}/notificationNumbers` subcollection (introduced
// in PR 1 of the verified-notification-numbers refactor).
//
// Sources mined:
//   1. organizations/{orgId}.whatsappSummariesPhone                 → backfill_org_summary
//   2. organizations/{orgId}/botConfig/config.notificationNumbers   → backfill_botconfig
//   3. users/{uid}.qualifiedLeadNotificationNumbers (org members,   → backfill_user_agent
//      role != "member")
//
// All inserted docs are marked `verified: true` — these phones were already
// receiving notifications, so re-verifying them would be a regression. The
// first verified number in each org becomes the org default
// (`isOrgDefault: true`), matching the onboarding default.
//
// After inserting, each listing under the org gets `notificationNumberIds`
// populated based on the legacy resolver's output (org-level + assigned agent's
// numbers). Listings with no resolvable phone are logged and skipped — their
// managers will need to pick numbers in the Listings UI before lead summaries
// resume.
//
// Run (dry-run by default — opt in to writes with --live):
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json \
//   npx ts-node functions/src/scripts/backfill_notification_numbers.ts
//
//   npx ts-node functions/src/scripts/backfill_notification_numbers.ts --live
//
// Idempotent: re-running skips numbers and listings already populated.

const DATABASE_ID = "realestate-whatsapp-bot";
const LIVE = process.argv.includes("--live");
const DRY_RUN = !LIVE;
const SINGLE_ORG = (() => {
  const idx = process.argv.indexOf("--org");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
})();

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db: Firestore = getFirestore(admin.app(), DATABASE_ID);

type SourceTag = NotificationNumberSource;

type NumberInsertPlan = {
  e164: string;
  phoneDigests: string;
  source: SourceTag;
  label?: string;
  legacyOwnerUid?: string;
};

type OrgBackfillResult = {
  orgId: string;
  numbersExisting: number;
  numbersCreated: number;
  numbersSkippedInvalid: number;
  listingsScanned: number;
  listingsUpdated: number;
  listingsSkipped: number;
  listingsAlreadyHadIds: number;
};

async function loadExistingNumbersByDigest(
  orgId: string
): Promise<Map<string, { numberId: string; isVerified: boolean }>> {
  const out = new Map<string, { numberId: string; isVerified: boolean }>();
  const snap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("notificationNumbers")
    .get();
  for (const doc of snap.docs) {
    const data = doc.data() as { phoneDigests?: string; verified?: boolean };
    if (typeof data.phoneDigests === "string" && data.phoneDigests) {
      out.set(data.phoneDigests, {
        numberId: doc.id,
        isVerified: data.verified === true,
      });
    }
  }
  return out;
}

async function loadOrgLegacyNumbers(orgId: string): Promise<NumberInsertPlan[]> {
  const plans: NumberInsertPlan[] = [];

  const orgSnap = await db.collection("organizations").doc(orgId).get();
  const orgData = (orgSnap.data() || {}) as { whatsappSummariesPhone?: string };
  for (const raw of splitNotificationNumberRaw(orgData.whatsappSummariesPhone)) {
    const e164 = normalizeToE164(raw);
    if (!e164) continue;
    plans.push({
      e164,
      phoneDigests: digestsFromE164(e164),
      source: "backfill_org_summary",
    });
  }

  const botCfgSnap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("botConfig")
    .doc("config")
    .get();
  const botCfg = (botCfgSnap.data() || {}) as { notificationNumbers?: string };
  for (const raw of splitNotificationNumberRaw(botCfg.notificationNumbers)) {
    const e164 = normalizeToE164(raw);
    if (!e164) continue;
    plans.push({
      e164,
      phoneDigests: digestsFromE164(e164),
      source: "backfill_botconfig",
    });
  }

  return plans;
}

async function loadAgentLegacyNumbers(orgId: string): Promise<NumberInsertPlan[]> {
  const plans: NumberInsertPlan[] = [];
  const usersSnap = await db.collection("users").where("orgId", "==", orgId).get();
  for (const doc of usersSnap.docs) {
    const data = doc.data() as {
      role?: string;
      qualifiedLeadNotificationNumbers?: string;
      name?: string;
      email?: string;
    };
    const role = typeof data.role === "string" ? data.role : "";
    if (role === "member") continue;
    const raw = data.qualifiedLeadNotificationNumbers;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const label = data.name || data.email;
    for (const part of splitNotificationNumberRaw(raw)) {
      const e164 = normalizeToE164(part);
      if (!e164) continue;
      plans.push({
        e164,
        phoneDigests: digestsFromE164(e164),
        source: "backfill_user_agent",
        legacyOwnerUid: doc.id,
        label,
      });
    }
  }
  return plans;
}

/** Deduplicate plans by phoneDigests preserving the first-seen entry (highest-priority source). */
function dedupePlans(plans: NumberInsertPlan[]): NumberInsertPlan[] {
  const seen = new Set<string>();
  const out: NumberInsertPlan[] = [];
  for (const p of plans) {
    if (seen.has(p.phoneDigests)) continue;
    seen.add(p.phoneDigests);
    out.push(p);
  }
  return out;
}

async function ensureOrgHasDefault(orgId: string): Promise<boolean> {
  const snap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("notificationNumbers")
    .where("isOrgDefault", "==", true)
    .limit(1)
    .get();
  return !snap.empty;
}

async function flushBatch(batch: WriteBatch, label: string): Promise<WriteBatch> {
  if (DRY_RUN) return batch;
  await batch.commit();
  console.log(`  · batch committed (${label})`);
  return db.batch();
}

async function backfillNumbersForOrg(
  orgId: string,
  result: OrgBackfillResult
): Promise<Map<string, string>> {
  const existing = await loadExistingNumbersByDigest(orgId);
  result.numbersExisting = existing.size;

  const orgPlans = await loadOrgLegacyNumbers(orgId);
  const agentPlans = await loadAgentLegacyNumbers(orgId);
  const planned = dedupePlans([...orgPlans, ...agentPlans]);

  let hasOrgDefault = await ensureOrgHasDefault(orgId);
  let batch = db.batch();
  let pending = 0;

  const digestToId = new Map<string, string>();
  for (const [digest, info] of existing) digestToId.set(digest, info.numberId);

  const collection = db.collection("organizations").doc(orgId).collection("notificationNumbers");

  for (const plan of planned) {
    if (existing.has(plan.phoneDigests)) {
      // Already in the new collection — keep its id mapped but don't touch it.
      continue;
    }
    const ref = collection.doc();
    const willBeDefault = !hasOrgDefault && plan.source !== "backfill_user_agent";
    if (willBeDefault) hasOrgDefault = true;
    const doc: Record<string, unknown> = {
      e164: plan.e164,
      phoneDigests: plan.phoneDigests,
      verified: true,
      verificationStatus: "approved",
      createdBy: "system:backfill",
      source: plan.source,
      verifiedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (plan.label) doc.label = plan.label;
    if (plan.legacyOwnerUid) doc.legacyOwnerUid = plan.legacyOwnerUid;
    if (willBeDefault) doc.isOrgDefault = true;

    if (DRY_RUN) {
      console.log(
        `  + [dry] ${plan.e164}  source=${plan.source}` +
          (willBeDefault ? "  default=true" : "") +
          (plan.legacyOwnerUid ? `  owner=${plan.legacyOwnerUid}` : "")
      );
    } else {
      batch.set(ref, doc);
      pending++;
      if (pending >= 400) {
        batch = await flushBatch(batch, `${orgId} numbers`);
        pending = 0;
      }
    }
    digestToId.set(plan.phoneDigests, ref.id);
    result.numbersCreated++;
  }

  if (!DRY_RUN && pending > 0) {
    await batch.commit();
    console.log(`  · batch committed (${orgId} numbers, final)`);
  }

  return digestToId;
}

async function fetchAssignedAgentDigests(
  orgId: string,
  assignedUid: string | undefined
): Promise<string[]> {
  const uid = (assignedUid || "").trim();
  if (!uid) return [];
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return [];
  const data = snap.data() || {};
  if (typeof data.orgId !== "string" || data.orgId !== orgId) return [];
  const role = typeof data.role === "string" ? data.role : "";
  if (role === "member") return [];
  const raw = data.qualifiedLeadNotificationNumbers;
  if (typeof raw !== "string" || !raw.trim()) return [];
  const out: string[] = [];
  for (const part of splitNotificationNumberRaw(raw)) {
    const e164 = normalizeToE164(part);
    if (e164) out.push(digestsFromE164(e164));
  }
  return out;
}

async function backfillListingsForOrg(
  orgId: string,
  digestToId: Map<string, string>,
  orgLevelDigests: string[],
  result: OrgBackfillResult
): Promise<void> {
  const listingsSnap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("listings")
    .get();
  result.listingsScanned = listingsSnap.size;

  let batch = db.batch();
  let pending = 0;
  for (const doc of listingsSnap.docs) {
    const data = doc.data() as {
      assignedAgentUid?: string;
      notificationNumberIds?: string[];
    };
    if (Array.isArray(data.notificationNumberIds) && data.notificationNumberIds.length > 0) {
      result.listingsAlreadyHadIds++;
      continue;
    }
    const agentDigests = await fetchAssignedAgentDigests(orgId, data.assignedAgentUid);
    const combined: string[] = [];
    const seen = new Set<string>();
    for (const d of [...orgLevelDigests, ...agentDigests]) {
      if (!d || seen.has(d)) continue;
      const id = digestToId.get(d);
      if (!id) continue;
      seen.add(d);
      combined.push(id);
    }
    if (combined.length === 0) {
      console.warn(
        `  ! listing ${doc.id}: no resolvable notification numbers (assignedAgentUid=${data.assignedAgentUid || "—"})`
      );
      result.listingsSkipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ~ [dry] listing ${doc.id} -> notificationNumberIds=[${combined.join(", ")}]`);
    } else {
      batch.update(doc.ref, {
        notificationNumberIds: combined,
        updatedAt: FieldValue.serverTimestamp(),
      });
      pending++;
      if (pending >= 400) {
        batch = await flushBatch(batch, `${orgId} listings`);
        pending = 0;
      }
    }
    result.listingsUpdated++;
  }
  if (!DRY_RUN && pending > 0) {
    await batch.commit();
    console.log(`  · batch committed (${orgId} listings, final)`);
  }
}

async function backfillOrg(orgId: string): Promise<OrgBackfillResult> {
  const result: OrgBackfillResult = {
    orgId,
    numbersExisting: 0,
    numbersCreated: 0,
    numbersSkippedInvalid: 0,
    listingsScanned: 0,
    listingsUpdated: 0,
    listingsSkipped: 0,
    listingsAlreadyHadIds: 0,
  };

  console.log(`\n[${orgId}]`);
  const digestToId = await backfillNumbersForOrg(orgId, result);

  // Org-level digests = union of whatsappSummariesPhone + botConfig.notificationNumbers,
  // normalized. The legacy resolver always merged these in regardless of assigned agent,
  // so every listing inherits them.
  const orgLegacy = await loadOrgLegacyNumbers(orgId);
  const orgLevelDigests = pickOrgLevelDigests(orgLegacy);

  await backfillListingsForOrg(orgId, digestToId, orgLevelDigests, result);
  return result;
}

function pickOrgLevelDigests(orgPlans: NumberInsertPlan[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of orgPlans) {
    if (seen.has(p.phoneDigests)) continue;
    seen.add(p.phoneDigests);
    out.push(p.phoneDigests);
  }
  return out;
}

async function main() {
  console.log(
    `backfill_notification_numbers (mode: ${DRY_RUN ? "DRY-RUN (use --live to write)" : "LIVE"})`
  );
  if (SINGLE_ORG) console.log(`Scope: single org "${SINGLE_ORG}"`);

  const orgIds: string[] = SINGLE_ORG
    ? [SINGLE_ORG]
    : (await db.collection("organizations").get()).docs.map((d) => d.id);

  if (orgIds.length === 0) {
    console.warn("No organizations to process.");
    return;
  }

  const results: OrgBackfillResult[] = [];
  for (const orgId of orgIds) {
    try {
      results.push(await backfillOrg(orgId));
    } catch (error) {
      console.error(`[${orgId}] ERROR:`, error);
    }
  }

  console.log("\n========================================");
  console.log(`SUMMARY (${DRY_RUN ? "DRY-RUN" : "LIVE"})`);
  for (const r of results) {
    console.log(
      `  ${r.orgId}: existing=${r.numbersExisting} created=${r.numbersCreated} ` +
        `listings scanned=${r.listingsScanned} updated=${r.listingsUpdated} ` +
        `skipped=${r.listingsSkipped} alreadyHad=${r.listingsAlreadyHadIds}`
    );
  }
  const totals = results.reduce(
    (acc, r) => ({
      created: acc.created + r.numbersCreated,
      existing: acc.existing + r.numbersExisting,
      updated: acc.updated + r.listingsUpdated,
      skipped: acc.skipped + r.listingsSkipped,
      alreadyHad: acc.alreadyHad + r.listingsAlreadyHadIds,
      scanned: acc.scanned + r.listingsScanned,
    }),
    { created: 0, existing: 0, updated: 0, skipped: 0, alreadyHad: 0, scanned: 0 }
  );
  console.log(
    `  TOTAL: orgs=${results.length} numbersCreated=${totals.created} ` +
      `numbersAlreadyPresent=${totals.existing} listingsScanned=${totals.scanned} ` +
      `listingsUpdated=${totals.updated} listingsSkipped=${totals.skipped} ` +
      `listingsAlreadyHadIds=${totals.alreadyHad}`
  );
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
