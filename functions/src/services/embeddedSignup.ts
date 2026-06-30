import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import crypto from "crypto";
import { getGcpProjectId } from "../utils/gcpProject";

const DATABASE_ID = "realestate-whatsapp-bot";
const GRAPH_API_VERSION = "v23.0";

let secretManagerClient: SecretManagerServiceClient | null = null;
function getSecretManagerClient(): SecretManagerServiceClient {
  if (!secretManagerClient) secretManagerClient = new SecretManagerServiceClient();
  return secretManagerClient;
}

/**
 * Exchange the short-lived `code` from Embedded Signup for a long-lived
 * business_integration_system_user_access_token. This token is granted by the
 * customer's WABA and does not expire.
 */
export async function exchangeCodeForToken(params: {
  code: string;
  appId: string;
  appSecret: string;
}): Promise<string> {
  const { code, appId, appSecret } = params;
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`,
    {
      params: { client_id: appId, client_secret: appSecret, code },
      timeout: 10000,
    }
  );
  const accessToken = (response.data as { access_token?: string }).access_token;
  if (!accessToken) {
    throw new Error("Meta OAuth response did not include access_token");
  }
  return accessToken;
}

/**
 * Register the phone number on Cloud API. Idempotent enough — Meta returns 200
 * if already registered with the same PIN; a different PIN yields an error we
 * rethrow.
 */
export async function registerPhoneNumber(params: {
  phoneNumberId: string;
  accessToken: string;
  pin: string;
  appSecretProof?: string;
}): Promise<void> {
  const { phoneNumberId, accessToken, pin, appSecretProof } = params;
  await axios.post(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/register`,
    { messaging_product: "whatsapp", pin },
    {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      params: appSecretProof ? { appsecret_proof: appSecretProof } : undefined,
      timeout: 10000,
    }
  );
}

/** Subscribe the Meta app to this WABA's webhooks. */
export async function subscribeAppToWaba(params: {
  wabaId: string;
  accessToken: string;
  appSecretProof?: string;
}): Promise<void> {
  const { wabaId, accessToken, appSecretProof } = params;
  await axios.post(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`,
    {},
    {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      params: appSecretProof ? { appsecret_proof: appSecretProof } : undefined,
      timeout: 10000,
    }
  );
}

/** Update WABA profile picture for the connected phone number. */
export async function setWhatsAppProfilePhoto(params: {
  phoneNumberId: string;
  accessToken: string;
  profilePictureUrl: string;
  appSecretProof?: string;
}): Promise<void> {
  const { phoneNumberId, accessToken, profilePictureUrl, appSecretProof } = params;
  await axios.post(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
    {
      messaging_product: "whatsapp",
      profile_picture_url: profilePictureUrl,
    },
    {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      params: appSecretProof ? { appsecret_proof: appSecretProof } : undefined,
      timeout: 10000,
    }
  );
}

/**
 * Write the access token into Secret Manager under a per-org name. Creates the
 * secret on first call, adds a new version on subsequent calls. Returns the
 * secret name (not the resource path) so callers can store it in Firestore.
 */
export async function storeAccessTokenInSecretManager(params: {
  orgId: string;
  accessToken: string;
}): Promise<string> {
  const { orgId, accessToken } = params;
  const secretId = `whatsapp_org_${orgId}_token`;
  const client = getSecretManagerClient();
  const projectId = getGcpProjectId();
  const parent = `projects/${projectId}`;
  const secretResource = `${parent}/secrets/${secretId}`;

  try {
    await client.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (error: unknown) {
    const code = (error as { code?: number })?.code;
    // 6 = ALREADY_EXISTS — fine, we'll just add a new version.
    if (code !== 6) throw error;
  }

  await client.addSecretVersion({
    parent: secretResource,
    payload: { data: Buffer.from(accessToken, "utf8") },
  });

  return secretId;
}

/**
 * Persist the cloudApiConfig on the org's botConfig/config document. Merges so
 * sibling fields (activeStyleId, styles, messagingProvider, etc.) are
 * preserved.
 */
export async function persistCloudApiConfigForOrg(params: {
  orgId: string;
  phoneNumberId: string;
  wabaId: string;
  accessTokenSecretName: string;
  verifyToken: string;
  displayPhoneNumber?: string | null;
  assistantAvatarId?: string;
  assistantAvatarName?: string;
  assistantAvatarUrl?: string;
}): Promise<void> {
  const {
    orgId,
    phoneNumberId,
    wabaId,
    accessTokenSecretName,
    verifyToken,
    displayPhoneNumber,
    assistantAvatarId,
    assistantAvatarName,
    assistantAvatarUrl,
  } = params;
  const db = getFirestore(admin.app(), DATABASE_ID);
  const ref = db.doc(`organizations/${orgId}/botConfig/config`);
  const cloudApiConfig: Record<string, unknown> = {
    accessTokenSecretName,
    phoneNumberId,
    wabaId,
    graphApiVersion: GRAPH_API_VERSION,
    verifyToken,
  };
  if (displayPhoneNumber) cloudApiConfig.displayPhoneNumber = displayPhoneNumber;
  if (assistantAvatarId) cloudApiConfig.assistantAvatarId = assistantAvatarId;
  if (assistantAvatarUrl) cloudApiConfig.assistantAvatarUrl = assistantAvatarUrl;
  await ref.set(
    {
      messagingProvider: "cloud_api",
      cloudApiConfig,
      ...(assistantAvatarName ? { assistantAvatarName } : {}),
    },
    { merge: true }
  );
  // Reverse-lookup index so the app-wide webhook can resolve org from entry[].id (= wabaId)
  // with a single doc read, no collectionGroup query needed.
  await db.doc(`wabaIndex/${wabaId}`).set(
    { orgId, phoneNumberId, updatedAt: new Date() },
    { merge: true }
  );
  await db.doc(`phoneNumberIndex/${phoneNumberId}`).set(
    { orgId, wabaId, updatedAt: new Date() },
    { merge: true }
  );
}

/**
 * After Embedded Signup + phone registration, fetch the actual E.164 display number
 * so we can build wa.me deep links (A6c) and show it in the UI.
 */
export async function fetchDisplayPhoneNumber(params: {
  phoneNumberId: string;
  accessToken: string;
  appSecretProof?: string;
}): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}`,
      {
        params: params.appSecretProof
          ? { fields: "display_phone_number,verified_name", appsecret_proof: params.appSecretProof }
          : { fields: "display_phone_number,verified_name" },
        headers: { Authorization: `Bearer ${params.accessToken}` },
        timeout: 10000,
      }
    );
    const raw = (res.data as { display_phone_number?: string }).display_phone_number || "";
    // Meta returns formats like "+34 669 35 41 77"; normalize to digits-only E.164 body.
    return raw ? raw.replace(/[^0-9]/g, "") : null;
  } catch (err) {
    console.warn("fetchDisplayPhoneNumber failed:", (err as Error)?.message || err);
    return null;
  }
}

/**
 * Resolve the WABA that owns a given phone number ID. Used to verify that the
 * client-supplied wabaId actually matches the one Meta has on file for the
 * phoneNumberId — otherwise an attacker who somehow obtained a valid OAuth
 * code could pair their own phoneNumberId with a victim org's wabaId in the
 * persistence step and pollute the wabaIndex.
 */
export async function fetchPhoneNumberWaba(params: {
  phoneNumberId: string;
  accessToken: string;
  appSecretProof?: string;
}): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}`,
      {
        params: params.appSecretProof
          ? { fields: "whatsapp_business_account", appsecret_proof: params.appSecretProof }
          : { fields: "whatsapp_business_account" },
        headers: { Authorization: `Bearer ${params.accessToken}` },
        timeout: 10000,
      }
    );
    const waba = (res.data as { whatsapp_business_account?: { id?: string } })
      .whatsapp_business_account;
    return typeof waba?.id === "string" && waba.id ? waba.id : null;
  } catch (err) {
    console.warn("fetchPhoneNumberWaba failed:", (err as Error)?.message || err);
    return null;
  }
}

/** Random 6-digit PIN for WhatsApp two-step verification on the number. */
export function generateRegistrationPin(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/** Generate an opaque verify token for the webhook handshake. */
export function generateVerifyToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
