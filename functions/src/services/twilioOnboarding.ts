import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

import {
  createSubaccount,
  createWhatsAppSender,
  pollSenderUntilOnline,
  type TwilioRawCredentials,
  type TwilioWhatsAppSender,
} from "./twilioClient";

const DATABASE_ID = "realestate-whatsapp-bot";
const PROJECT_ID_FALLBACK = "real-estate-idealista-bot";

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

/**
 * Upsert the per-org Twilio subaccount auth token into Secret Manager.
 * Returns the secret ID (not full resource path) for storage in Firestore.
 *
 * Idempotent: creates the secret on first call, adds a new version on later
 * calls. Mirrors the pattern used by twilioMigration.ts.
 */
async function upsertSubaccountAuthTokenSecret(params: {
  orgId: string;
  authToken: string;
}): Promise<string> {
  const sm = getSecretManagerClient();
  const projectId = getGcpProjectId();
  const secretId = `twilio_org_${params.orgId}_auth_token`;
  const parent = `projects/${projectId}`;
  try {
    await sm.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 6) throw error; // 6 = ALREADY_EXISTS
  }
  await sm.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: { data: Buffer.from(params.authToken, "utf8") },
  });
  return secretId;
}

export type TwilioOnboardingResult = {
  subaccountSid: string;
  /** Subaccount auth token, returned in-memory so the caller can immediately
   * kick off downstream work (e.g. cloning content templates via
   * startMigration). Never include this in HTTP responses. */
  subaccountAuthToken: string;
  senderSid: string;
  status: string;
  displayPhoneNumber?: string;
};

/**
 * End-to-end Twilio Tech Provider onboarding driven by Embedded Signup output.
 *
 * Inputs come from Meta's `WA_EMBEDDED_SIGNUP / FINISH` postMessage event after
 * the user verified their number inside the Meta popup. Because we passed our
 * Partner Solution ID to FB.login, Meta has already shared the WABA with
 * Twilio's solution — we only have to claim it as a sender on a fresh subaccount.
 *
 * Steps:
 *   1. Create a per-org subaccount (master creds).
 *   2. Store the subaccount auth token in Secret Manager.
 *   3. Create the WhatsApp sender bound to (waba_id, phone_number_e164).
 *   4. Poll until status=ONLINE (~30-60s typical).
 *   5. Persist twilioConfig on the org's botConfig and write reverse-lookup
 *      indices (wabaIndex, phoneNumberIndex) used by the inbound webhook.
 */
export async function onboardTwilioTechProviderSender(params: {
  orgId: string;
  masterCreds: TwilioRawCredentials;
  wabaId: string;
  phoneNumberId: string;
  /** E.164 with leading +, captured from Meta's display_phone_number. */
  senderE164: string;
  /** Public URL of the cloud function that receives Twilio inbound webhooks. */
  inboundWebhookUrl: string;
  /** Optional friendly name for the subaccount (defaults to "Proplead org <id>"). */
  subaccountFriendlyName?: string;
  profileName?: string;
  assistantAvatarId?: string;
  assistantAvatarName?: string;
  assistantAvatarUrl?: string;
}): Promise<TwilioOnboardingResult> {
  const {
    orgId,
    masterCreds,
    wabaId,
    phoneNumberId,
    senderE164,
    inboundWebhookUrl,
    subaccountFriendlyName,
    profileName,
    assistantAvatarId,
    assistantAvatarName,
    assistantAvatarUrl,
  } = params;

  // 1. Create the subaccount.
  const subaccount = await createSubaccount(masterCreds, {
    friendlyName: subaccountFriendlyName || `Proplead org ${orgId}`,
  });
  const subaccountCreds: TwilioRawCredentials = {
    accountSid: subaccount.sid,
    authToken: subaccount.authToken,
  };

  // 2. Persist the subaccount auth token (Twilio only returns it once).
  const authTokenSecretName = await upsertSubaccountAuthTokenSecret({
    orgId,
    authToken: subaccount.authToken,
  });

  // 3. Create the WhatsApp sender on the subaccount.
  const created = await createWhatsAppSender(subaccountCreds, {
    senderE164,
    wabaId,
    callbackUrl: inboundWebhookUrl,
    profileName,
    profileVertical: "OTHER",
  });

  // 4. Wait for ONLINE so the UI can show a confirmed state.
  //
  // Observed in production: brand-new Tech Provider senders linger in
  // CREATING/OFFLINE for ~30-90s while Twilio waits for Meta to propagate the
  // WABA share, then flip to ONLINE. 90s here keeps headroom inside the
  // 120s cloud function timeout, leaving time for the template clone.
  let finalSender: TwilioWhatsAppSender = created;
  try {
    finalSender = await pollSenderUntilOnline(subaccountCreds, created.sid, {
      timeoutMs: 90_000,
      intervalMs: 3_000,
    });
  } catch (error) {
    // Sender is created but didn't reach ONLINE in time. We still persist the
    // partial config so the org isn't orphaned; the dashboard can show a
    // "pending verification" state and resume polling later.
    console.warn(
      `[twilioOnboarding] Sender ${created.sid} did not reach ONLINE in time:`,
      error instanceof Error ? error.message : error
    );
  }

  // 5. Persist twilioConfig + indices for inbound routing.
  const db = getFirestore(admin.app(), DATABASE_ID);
  const botConfigRef = db.doc(`organizations/${orgId}/botConfig/config`);
  const displayDigits = senderE164.replace(/\D/g, "");
  const twilioConfig: Record<string, unknown> = {
    accountSid: subaccount.sid,
    authTokenSecretName,
    whatsappNumber: senderE164.startsWith("+") ? senderE164 : `+${displayDigits}`,
    senderSid: finalSender.sid,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: displayDigits,
  };
  if (assistantAvatarId) twilioConfig.assistantAvatarId = assistantAvatarId;
  if (assistantAvatarName) twilioConfig.assistantAvatarName = assistantAvatarName;
  if (assistantAvatarUrl) twilioConfig.assistantAvatarUrl = assistantAvatarUrl;

  await botConfigRef.set(
    {
      messagingProvider: "twilio",
      twilioConfig,
      ...(assistantAvatarName ? { assistantAvatarName } : {}),
    },
    { merge: true }
  );

  await db.doc(`wabaIndex/${wabaId}`).set(
    { orgId, phoneNumberId, senderSid: finalSender.sid, updatedAt: new Date() },
    { merge: true }
  );
  await db.doc(`phoneNumberIndex/${phoneNumberId}`).set(
    { orgId, wabaId, senderSid: finalSender.sid, updatedAt: new Date() },
    { merge: true }
  );

  return {
    subaccountSid: subaccount.sid,
    subaccountAuthToken: subaccount.authToken,
    senderSid: finalSender.sid,
    status: finalSender.status || "UNKNOWN",
    displayPhoneNumber: displayDigits,
  };
}
