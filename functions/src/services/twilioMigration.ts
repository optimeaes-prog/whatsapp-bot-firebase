import * as admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

import { REGION } from "../shared";
import type { BotConfig, TwilioTemplateNames } from "../types";
import {
  configureWhatsAppSenderWebhook,
  createContentTemplateWithCreds,
  fetchContentApprovalStatus,
  listAllContentTemplates,
  listWhatsAppSenders,
  normalizeWhatsAppTemplateName,
  submitContentForWhatsAppApproval,
  twilioTemplateDedupeKey,
  verifyTwilioCredentials,
  type TwilioContentTemplate,
  type TwilioRawCredentials,
} from "./twilioClient";
import {
  REALESTATE_DB_ID,
  TWILIO_MIGRATION_JOBS_COLLECTION,
  TWILIO_MIGRATION_MAX_AGE_MS,
  mapFriendlyNameToSlot,
  type TwilioMigrationJob,
  type TwilioMigrationTemplateState,
} from "./twilioMigrationTypes";

const PROJECT_ID_FALLBACK = "real-estate-idealista-bot";
const TWILIO_INBOUND_WEBHOOK_URL = `https://${REGION}-${PROJECT_ID_FALLBACK}.cloudfunctions.net/twilioWebhook`;

let secretManagerClient: SecretManagerServiceClient | null = null;
function getSecretManagerClient(): SecretManagerServiceClient {
  if (!secretManagerClient) secretManagerClient = new SecretManagerServiceClient();
  return secretManagerClient;
}

function getGcpProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    admin.app().options.projectId ||
    PROJECT_ID_FALLBACK
  );
}

function db() {
  return getFirestore(admin.app(), REALESTATE_DB_ID);
}

async function accessSecretLatest(secretId: string): Promise<string> {
  const sm = getSecretManagerClient();
  const [version] = await sm.accessSecretVersion({
    name: `projects/${getGcpProjectId()}/secrets/${secretId}/versions/latest`,
  });
  const payload = version.payload?.data;
  if (!payload) throw new Error(`Secret ${secretId} has no payload`);
  return Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload);
}

/**
 * Create-or-add-version on a Secret Manager secret. Idempotent.
 * Returns the secret resource id (not full path) for storage in Firestore.
 */
async function upsertAuthTokenSecret(orgId: string, authToken: string): Promise<string> {
  const sm = getSecretManagerClient();
  const projectId = getGcpProjectId();
  const secretId = `twilio_org_${orgId}_auth_token`;
  const secretPath = `projects/${projectId}/secrets/${secretId}`;
  try {
    await sm.createSecret({
      parent: `projects/${projectId}`,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 6) throw error; // 6 = ALREADY_EXISTS
  }
  let latestPayload = "";
  try {
    const [latest] = await sm.accessSecretVersion({ name: `${secretPath}/versions/latest` });
    latestPayload = Buffer.from(latest.payload?.data || "").toString("utf8").trim();
  } catch {
    latestPayload = "";
  }
  if (latestPayload !== authToken.trim()) {
    await sm.addSecretVersion({
      parent: secretPath,
      payload: { data: Buffer.from(authToken.trim(), "utf8") },
    });
  }
  return secretId;
}

/**
 * Read the source org's stored Twilio credentials from Firestore + Secret Manager.
 * Throws if the source org doesn't have a complete Twilio config.
 */
async function resolveOrgTwilioCredentials(orgId: string): Promise<TwilioRawCredentials & { whatsappNumber: string }> {
  const snap = await db().doc(`organizations/${orgId}/botConfig/config`).get();
  const cfg = (snap.data() || {}) as BotConfig;
  const accountSid = cfg.twilioConfig?.accountSid?.trim();
  const whatsappNumber = cfg.twilioConfig?.whatsappNumber?.trim();
  const authTokenSecretName = cfg.twilioConfig?.authTokenSecretName?.trim();
  if (!accountSid || !whatsappNumber || !authTokenSecretName) {
    throw new Error(`Source org ${orgId} has no complete twilioConfig`);
  }
  const authToken = (await accessSecretLatest(authTokenSecretName)).trim();
  if (!authToken) throw new Error(`Source org ${orgId} auth token secret is empty`);
  return { accountSid, authToken, whatsappNumber };
}

export interface StartMigrationInput {
  targetOrgId: string;
  sourceOrgId: string;
  newAccountSid: string;
  newAuthToken: string;
  /** Caller identity, captured into the job doc for audit. */
  actor: { uid: string; email?: string };
}

export interface StartMigrationResult {
  jobId: string;
  resumed: boolean;
  newSenderSid: string;
  newWhatsappNumber: string;
  totalTemplates: number;
  submittedTemplates: number;
}

/**
 * Idempotent migration kickoff. Safe to re-invoke with the same inputs:
 *   - Reuses an existing in-flight job for the target org if one exists.
 *   - Snapshots source templates into the job doc BEFORE rotating the secret,
 *     so resumes work even when sourceOrgId === targetOrgId.
 *   - Skips template creation when the destination already has a matching
 *     friendly_name::language pair, or when the job already recorded a newSid.
 *   - Skips approval submission when an approval already exists for the SID.
 */
export async function startMigration(input: StartMigrationInput): Promise<StartMigrationResult> {
  const targetOrgId = input.targetOrgId.trim();
  const sourceOrgId = input.sourceOrgId.trim();
  const newAccountSid = input.newAccountSid.trim();
  const newAuthToken = input.newAuthToken.trim();
  if (!targetOrgId || !sourceOrgId) throw new Error("targetOrgId and sourceOrgId are required");
  if (!newAccountSid || !newAuthToken) throw new Error("newAccountSid and newAuthToken are required");

  // Same-source-as-target is explicitly supported: it's used when an org's
  // current Twilio account is being replaced by a fresh one and its templates
  // need to be cloned into the new account before its botConfig is repointed.
  const sameOrg = sourceOrgId === targetOrgId;
  const newCreds: TwilioRawCredentials = { accountSid: newAccountSid, authToken: newAuthToken };

  // 0. Pre-flight: verify the pasted credentials are valid against Twilio's
  //    universal Accounts endpoint. Gives a clean "Auth Token invalid" error
  //    instead of a confusing 401 from a deeper API call.
  await verifyTwilioCredentials(newCreds);

  // 1. Verify the new account has exactly one WhatsApp sender.
  const senders = await listWhatsAppSenders(newCreds);
  const online = senders.filter((s) => (s.status || "").toUpperCase() === "ONLINE");
  const usable = online.length > 0 ? online : senders;
  if (usable.length === 0) {
    throw new Error("No WhatsApp senders found on the new Twilio account");
  }
  if (usable.length > 1) {
    throw new Error(
      `Expected exactly 1 WhatsApp sender on new account, found ${usable.length}. Please remove unused senders.`
    );
  }
  const sender = usable[0];
  if (!sender.sender_id) {
    throw new Error("New WhatsApp sender has no phone number");
  }

  // 2. Find or create the migration job. One in-flight job per target org.
  const jobsCol = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION);
  const existing = await jobsCol
    .where("targetOrgId", "==", targetOrgId)
    .where("status", "in", [
      "pending",
      "templates_snapshotted",
      "templates_submitted",
      "awaiting_approval",
    ])
    .limit(1)
    .get();

  let jobId: string;
  let resumed: boolean;
  if (!existing.empty) {
    jobId = existing.docs[0].id;
    resumed = true;
  } else {
    const targetCfgSnap = await db().doc(`organizations/${targetOrgId}/botConfig/config`).get();
    const previousTwilioConfig = (targetCfgSnap.data() as BotConfig | undefined)?.twilioConfig;
    const newDoc = jobsCol.doc();
    jobId = newDoc.id;
    resumed = false;
    const initial: Partial<TwilioMigrationJob> = {
      status: "pending",
      targetOrgId,
      sourceOrgId,
      newAccountSid,
      newWhatsappNumber: sender.sender_id,
      newSenderSid: sender.sid,
      // `authTokenSecretName` populated below once the secret is upserted.
      authTokenSecretName: "",
      createdBy: input.actor,
      createdAt: FieldValue.serverTimestamp() as unknown,
      updatedAt: FieldValue.serverTimestamp() as unknown,
      webhookConfigured: false,
      previousTwilioConfig: previousTwilioConfig || null,
      templates: {},
      errors: [],
    };
    await newDoc.set(initial);
  }
  const jobRef = jobsCol.doc(jobId);

  // 3. Snapshot source templates into the job doc BEFORE rotating the secret.
  //    This is critical for the sameOrg case: once the secret is rotated, we
  //    lose access to the OLD Twilio account's templates. By persisting source
  //    definitions (friendly_name, language, variables, types) into the job
  //    upfront, resumes can recreate any template that wasn't yet cloned.
  const snapshotted = await snapshotSourceTemplatesIfMissing(jobRef, sourceOrgId);

  // 4. Store the new auth token in Secret Manager (idempotent). Safe to do AFTER
  //    the snapshot because we never read from source again past this point.
  const authTokenSecretName = await upsertAuthTokenSecret(targetOrgId, newAuthToken);
  await jobRef.set(
    { authTokenSecretName, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // 5. Configure the inbound webhook on the new sender (idempotent).
  try {
    await configureWhatsAppSenderWebhook(newCreds, {
      senderSid: sender.sid,
      callbackUrl: TWILIO_INBOUND_WEBHOOK_URL,
      callbackMethod: "POST",
    });
    await jobRef.set({ webhookConfigured: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch (error) {
    await recordJobError(jobRef, "configure_webhook", error);
    throw error;
  }

  // 6. Write the target org's twilioConfig immediately so the new sender works for freeform.
  //    `smsSenderId` defaults to the WA number (acceptable for WA-only accounts).
  await db().doc(`organizations/${targetOrgId}/botConfig/config`).set(
    {
      messagingProvider: "twilio",
      twilioConfig: {
        accountSid: newAccountSid,
        whatsappNumber: sender.sender_id,
        smsSenderId: sender.sender_id,
        authTokenSecretName,
      },
    },
    { merge: true }
  );

  // 7. Stop here. Two-phase flow: this function does the credential / webhook /
  //    botConfig wiring + persists a snapshot of every source template into the
  //    job doc. The admin then reviews the list in the UI, deselects anything
  //    they don't want, and calls `submitMigrationTemplates` for the second phase.
  //    `sameOrg` and `snapshotted` are referenced here to silence unused-var
  //    diagnostics (they're useful for future telemetry).
  void snapshotted;
  void sameOrg;

  const jobSnap = await jobRef.get();
  const job = (jobSnap.data() || {}) as TwilioMigrationJob;
  const currentTemplates = job.templates || {};

  // Only flip to `templates_snapshotted` if no template has been submitted yet.
  // Once submission has begun on a resume, the status reflects the later phase.
  const alreadySubmitted = Object.values(currentTemplates).some(
    (t) => t.approvalStatus !== "not_submitted" && t.approvalStatus
  );
  if (!alreadySubmitted) {
    await jobRef.set(
      { status: "templates_snapshotted", updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  return {
    jobId,
    resumed,
    newSenderSid: sender.sid,
    newWhatsappNumber: sender.sender_id,
    totalTemplates: Object.keys(currentTemplates).length,
    submittedTemplates: 0,
  };
}

/**
 * Second phase: create + submit selected source templates for WhatsApp approval.
 *
 * @param jobId Migration job id (returned by `startMigration`).
 * @param friendlyNames If provided, only templates whose `friendlyName` is in
 *   this set are processed. Templates outside the set are left as-is in the job
 *   doc (status "not_submitted") so they can be resubmitted later if desired.
 *   When omitted, all snapshotted templates are submitted.
 */
export async function submitMigrationTemplates(
  jobId: string,
  friendlyNames?: string[]
): Promise<{
  total: number;
  submitted: number;
  skipped: number;
}> {
  const jobRef = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION).doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new Error(`Migration job ${jobId} not found`);
  const job = snap.data() as TwilioMigrationJob;
  if (job.status === "complete" || job.status === "failed") {
    throw new Error(`Migration job ${jobId} is ${job.status}; cannot submit templates`);
  }
  if (!job.authTokenSecretName) {
    throw new Error("Migration job has no authTokenSecretName yet; run prepare phase first");
  }

  const authToken = (await accessSecretLatest(job.authTokenSecretName)).trim();
  const newCreds: TwilioRawCredentials = { accountSid: job.newAccountSid, authToken };

  // Pre-fetch existing templates in the new account so we can short-circuit
  // creation when a friendly_name::language pair already exists there.
  const newAccountTemplates = await listAllContentTemplates(newCreds);
  const newAccountByKey = new Map<string, TwilioContentTemplate>();
  for (const t of newAccountTemplates) newAccountByKey.set(twilioTemplateDedupeKey(t), t);

  const selection = friendlyNames ? new Set(friendlyNames) : null;
  const currentTemplates: Record<string, TwilioMigrationTemplateState> = {
    ...(job.templates || {}),
  };

  let submittedCount = 0;
  let skippedCount = 0;

  for (const [key, state] of Object.entries(currentTemplates)) {
    if (selection && !selection.has(state.friendlyName)) {
      skippedCount += 1;
      continue;
    }

    // Resolve or create the new SID.
    let newSid = state.newSid;
    if (!newSid) {
      const preexisting = newAccountByKey.get(key);
      if (preexisting) {
        newSid = preexisting.sid;
      } else {
        try {
          const created = await createContentTemplateWithCreds(newCreds, {
            friendlyName: state.friendlyName,
            language: state.language,
            variables: state.sourceVariables,
            types: state.sourceTypes || {},
          });
          newSid = created.contentSid;
        } catch (error) {
          await recordJobError(jobRef, `create_content:${state.friendlyName}`, error);
          continue;
        }
      }
    }

    // Submit for WhatsApp approval if not yet submitted.
    let approvalStatus = state.approvalStatus || "not_submitted";
    let approvalRejectionReason = state.approvalRejectionReason;
    let submittedAt = state.submittedAt;
    if (approvalStatus === "not_submitted") {
      try {
        const current = await fetchContentApprovalStatus(newCreds, newSid);
        if (current?.status) {
          approvalStatus = normalizeApprovalStatus(current.status);
          approvalRejectionReason = current.rejection_reason;
        } else {
          const submitted = await submitContentForWhatsAppApproval(newCreds, {
            contentSid: newSid,
            name: normalizeWhatsAppTemplateName(state.friendlyName),
            category: "MARKETING",
          });
          approvalStatus = normalizeApprovalStatus(submitted.status || "received");
          approvalRejectionReason = submitted.rejection_reason;
          submittedAt = FieldValue.serverTimestamp() as unknown;
        }
        submittedCount += 1;
      } catch (error) {
        await recordJobError(jobRef, `submit_approval:${state.friendlyName}`, error);
      }
    }

    currentTemplates[key] = {
      ...state,
      newSid,
      approvalStatus,
      approvalRejectionReason,
      submittedAt,
      lastPolledAt: FieldValue.serverTimestamp() as unknown,
    };
  }

  await jobRef.set(
    {
      templates: currentTemplates,
      status: "templates_submitted",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Eagerly apply any approvals that came back synchronously.
  await applyApprovedTemplatesToOrg(jobId);

  return {
    total: Object.keys(currentTemplates).length,
    submitted: submittedCount,
    skipped: skippedCount,
  };
}

/**
 * Read every template from the source Twilio account and write a snapshot into
 * the job doc's `templates` map. Idempotent: skips entries that already exist
 * (so a resumed migration won't re-list source, and a same-source-as-target
 * resume never depends on the source secret post-rotation).
 *
 * Returns the number of templates added by this call.
 */
async function snapshotSourceTemplatesIfMissing(
  jobRef: FirebaseFirestore.DocumentReference,
  sourceOrgId: string
): Promise<number> {
  const snap = await jobRef.get();
  const job = (snap.data() || {}) as TwilioMigrationJob;
  const existing = { ...(job.templates || {}) };
  // If the snapshot was already taken (at least one entry exists), trust it and skip.
  if (Object.keys(existing).length > 0) return 0;

  const sourceCreds = await resolveOrgTwilioCredentials(sourceOrgId);
  const sourceTemplates = await listAllContentTemplates(sourceCreds);

  let added = 0;
  for (const src of sourceTemplates) {
    const key = twilioTemplateDedupeKey(src);
    if (existing[key]) continue;
    const mappedSlot = mapFriendlyNameToSlot(src.friendly_name);
    const is8Var =
      /agent[_-]?notification[_-]?8var/i.test(src.friendly_name) ||
      Object.keys(src.variables || {}).length >= 8;
    existing[key] = {
      sourceSid: src.sid,
      friendlyName: src.friendly_name,
      language: src.language,
      sourceVariables: src.variables,
      sourceTypes: src.types,
      mappedSlot,
      is8VarAgentNotification: is8Var && mappedSlot === "agentNotification" ? true : undefined,
      approvalStatus: "not_submitted",
    };
    added += 1;
  }
  await jobRef.set(
    { templates: existing, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return added;
}

/**
 * Poll Twilio for the approval status of every pending template on a job and
 * write approved HX SIDs into the target org's botConfig.twilioTemplates.
 */
export async function pollMigration(jobId: string): Promise<{ updated: number; complete: boolean }> {
  const jobRef = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION).doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new Error(`Migration job ${jobId} not found`);
  const job = snap.data() as TwilioMigrationJob;
  if (job.status === "complete" || job.status === "failed") {
    return { updated: 0, complete: job.status === "complete" };
  }

  const authToken = (await accessSecretLatest(job.authTokenSecretName)).trim();
  const newCreds: TwilioRawCredentials = { accountSid: job.newAccountSid, authToken };

  const templates = { ...(job.templates || {}) };
  let updatedCount = 0;
  for (const [key, state] of Object.entries(templates)) {
    if (!state.newSid) continue;
    if (state.approvalStatus === "approved" || state.approvalStatus === "rejected") continue;
    try {
      const current = await fetchContentApprovalStatus(newCreds, state.newSid);
      const newStatus = normalizeApprovalStatus(current?.status || state.approvalStatus);
      if (newStatus !== state.approvalStatus) {
        templates[key] = {
          ...state,
          approvalStatus: newStatus,
          approvalRejectionReason: current?.rejection_reason || state.approvalRejectionReason,
          approvedAt: newStatus === "approved" ? (FieldValue.serverTimestamp() as unknown) : state.approvedAt,
          lastPolledAt: FieldValue.serverTimestamp() as unknown,
        };
        updatedCount += 1;
      } else {
        templates[key] = { ...state, lastPolledAt: FieldValue.serverTimestamp() as unknown };
      }
    } catch (error) {
      await recordJobError(jobRef, `poll_approval:${state.friendlyName}`, error);
    }
  }

  await jobRef.set({ templates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await applyApprovedTemplatesToOrg(jobId);

  const refreshed = (await jobRef.get()).data() as TwilioMigrationJob;
  return {
    updated: updatedCount,
    complete: refreshed.status === "complete",
  };
}

/**
 * For each approved template on a job whose `mappedSlot` is set, write the new
 * HX SID into the target org's botConfig.twilioTemplates.
 *
 * Overwrite semantics: when a slot already holds a value from a previous Twilio
 * account, that SID is invalid on the new account and MUST be replaced. We
 * therefore always write the approved newSid (skipping only when it's identical
 * to the current value, to avoid no-op Firestore writes). This is also what
 * enables the same-source-as-target migration (target's stored SIDs are exactly
 * the OLD account's SIDs that we're replacing).
 *
 * Marks the job `complete` when every required slot is filled.
 * Marks the job `failed` when more than TWILIO_MIGRATION_MAX_AGE_MS has elapsed.
 */
async function applyApprovedTemplatesToOrg(jobId: string): Promise<void> {
  const jobRef = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION).doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) return;
  const job = snap.data() as TwilioMigrationJob;

  const cfgRef = db().doc(`organizations/${job.targetOrgId}/botConfig/config`);
  const cfgSnap = await cfgRef.get();
  const existingSlots: TwilioTemplateNames = (cfgSnap.data() as BotConfig | undefined)?.twilioTemplates || {};
  const slotUpdates: Partial<TwilioTemplateNames> = {};
  let any8Var = existingSlots.agentNotificationIs8Var || false;

  for (const state of Object.values(job.templates || {})) {
    if (state.approvalStatus !== "approved" || !state.newSid || !state.mappedSlot) continue;
    // Always overwrite — old SIDs from a previous Twilio account are invalid on
    // the new account. Skip only when the slot is already exactly the new SID
    // (to avoid redundant writes on repeated poll loops).
    if (existingSlots[state.mappedSlot] === state.newSid) continue;
    (slotUpdates as Record<string, string>)[state.mappedSlot] = state.newSid;
    if (state.mappedSlot === "agentNotification" && state.is8VarAgentNotification) {
      any8Var = true;
    }
  }

  if (Object.keys(slotUpdates).length > 0 || any8Var !== !!existingSlots.agentNotificationIs8Var) {
    await cfgRef.set(
      {
        twilioTemplates: {
          ...slotUpdates,
          ...(any8Var ? { agentNotificationIs8Var: true } : {}),
        },
      },
      { merge: true }
    );
  }

  // Decide terminal state.
  //
  // Completion semantics: "everything the admin actually submitted has settled."
  // - `not_submitted` templates are an explicit opt-out and DON'T block completion.
  // - `received` / `pending` mean WhatsApp is still reviewing — those block.
  // - `approved` / `rejected` / `paused` / `disabled` are all terminal — they pass.
  //
  // We require at least one submitted template (otherwise "complete" would be
  // vacuously true for a job where nothing was ever attempted), and we cap the
  // job age so a perpetually-stuck approval eventually flips to `failed` for
  // operator attention. REQUIRED_TWILIO_TEMPLATE_SLOTS is intentionally NOT a
  // hard gate anymore — the admin's Step-2 selection is the implicit required
  // set, since they explicitly chose what to submit.
  const createdAtMs = toMillis(job.createdAt) || Date.now();
  const ageMs = Date.now() - createdAtMs;
  const anyPending = Object.values(job.templates || {}).some(
    (t) => t.approvalStatus === "pending" || t.approvalStatus === "received"
  );
  const anySubmitted = Object.values(job.templates || {}).some(
    (t) => t.approvalStatus !== "not_submitted"
  );

  let nextStatus: TwilioMigrationJob["status"] = "awaiting_approval";
  if (anySubmitted && !anyPending) nextStatus = "complete";
  else if (ageMs > TWILIO_MIGRATION_MAX_AGE_MS) nextStatus = "failed";

  if (nextStatus !== job.status) {
    await jobRef.set({ status: nextStatus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

/**
 * Manually flip a job to `complete` regardless of approval state. Used when the
 * admin has performed the equivalent of completion outside the system (e.g.
 * manually edited `botConfig.twilioTemplates`) and just wants the job out of
 * the in-flight list. No-op when the job is already complete/failed.
 */
export async function forceCompleteMigration(jobId: string): Promise<{ ok: true }> {
  const jobRef = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION).doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new Error(`Migration job ${jobId} not found`);
  const job = snap.data() as TwilioMigrationJob;
  if (job.status === "complete" || job.status === "failed") return { ok: true };
  await jobRef.set(
    { status: "complete", updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { ok: true };
}

/**
 * Run pollMigration over every in-flight job. Called by the 10-min scheduler.
 */
export async function pollAllInFlightMigrations(): Promise<{ scanned: number; updated: number }> {
  const jobsCol = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION);
  const inFlight = await jobsCol
    .where("status", "in", ["templates_submitted", "awaiting_approval"])
    .get();
  let updated = 0;
  for (const docSnap of inFlight.docs) {
    try {
      const r = await pollMigration(docSnap.id);
      updated += r.updated;
    } catch (error) {
      console.error(`pollAllInFlightMigrations: job ${docSnap.id} failed`, error);
    }
  }
  return { scanned: inFlight.size, updated };
}

/**
 * Manually retry a specific named step on a job. Currently supports:
 *   - "webhook"  → re-configure the WA sender webhook URL
 *   - "submit:<friendly_name>" → re-attempt approval submission for one template
 */
export async function retryMigrationStep(jobId: string, step: string): Promise<{ ok: true }> {
  const jobRef = db().collection(TWILIO_MIGRATION_JOBS_COLLECTION).doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new Error(`Job ${jobId} not found`);
  const job = snap.data() as TwilioMigrationJob;
  const authToken = (await accessSecretLatest(job.authTokenSecretName)).trim();
  const newCreds: TwilioRawCredentials = { accountSid: job.newAccountSid, authToken };

  if (step === "webhook") {
    if (!job.newSenderSid) throw new Error("Job has no newSenderSid; cannot reconfigure webhook");
    await configureWhatsAppSenderWebhook(newCreds, {
      senderSid: job.newSenderSid,
      callbackUrl: TWILIO_INBOUND_WEBHOOK_URL,
      callbackMethod: "POST",
    });
    await jobRef.set({ webhookConfigured: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  }

  if (step.startsWith("submit:")) {
    const friendlyName = step.slice("submit:".length);
    const entry = Object.entries(job.templates || {}).find(
      ([, t]) => t.friendlyName === friendlyName
    );
    if (!entry || !entry[1].newSid) throw new Error(`Template ${friendlyName} not found on job`);
    const [key, state] = entry;
    const submitted = await submitContentForWhatsAppApproval(newCreds, {
      contentSid: state.newSid!,
      name: normalizeWhatsAppTemplateName(state.friendlyName),
      category: "MARKETING",
    });
    const newTemplates = { ...(job.templates || {}) };
    newTemplates[key] = {
      ...state,
      approvalStatus: normalizeApprovalStatus(submitted.status || "received"),
      approvalRejectionReason: submitted.rejection_reason,
      submittedAt: FieldValue.serverTimestamp() as unknown,
      lastPolledAt: FieldValue.serverTimestamp() as unknown,
    };
    await jobRef.set({ templates: newTemplates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  }

  throw new Error(`Unknown step: ${step}`);
}

async function recordJobError(
  jobRef: FirebaseFirestore.DocumentReference,
  step: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`twilioMigration[${step}]`, message);
  await jobRef.set(
    {
      errors: FieldValue.arrayUnion({
        at: Timestamp.now(),
        step,
        message,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function normalizeApprovalStatus(raw: string): TwilioMigrationTemplateState["approvalStatus"] {
  const v = (raw || "").trim().toLowerCase();
  switch (v) {
    case "approved":
    case "rejected":
    case "received":
    case "pending":
    case "paused":
    case "disabled":
      return v as TwilioMigrationTemplateState["approvalStatus"];
    case "submitted":
      return "received";
    default:
      return "not_submitted";
  }
}

function toMillis(value: unknown): number | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toMillis();
  const maybe = value as { toMillis?: () => number; _seconds?: number };
  if (typeof maybe.toMillis === "function") return maybe.toMillis();
  if (typeof maybe._seconds === "number") return maybe._seconds * 1000;
  return undefined;
}
