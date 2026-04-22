import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { getActiveOrgId } from "./requestContext";
import type { CloudApiConfig, CloudApiTemplateNames } from "../types";

/**
 * WhatsApp Cloud API client (Meta Graph API).
 *
 * Credentials are per-organization:
 * - `cloudApiConfig.accessTokenSecretName` → secret name in Google Secret Manager (we look up the latest version at runtime).
 * - `cloudApiConfig.phoneNumberId`, `wabaId`, `graphApiVersion` → stored directly in Firestore.
 *
 * Runtime-resolved secrets are NOT declared via `defineSecret()` (that pattern is static/deploy-time only).
 * Functions that use this client must have IAM access to Secret Manager (default Cloud Functions service account
 * needs `roles/secretmanager.secretAccessor`).
 */

const DATABASE_ID = "realestate-whatsapp-bot";
const DEFAULT_GRAPH_API_VERSION = "v23.0";
const CREDENTIALS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

type CachedCredentials = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  graphApiVersion: string;
  templates?: CloudApiTemplateNames;
  expiry: number;
};

const credentialsCache: Record<string, CachedCredentials> = {};

let secretManagerClient: SecretManagerServiceClient | null = null;

function getSecretManagerClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  return secretManagerClient;
}

function getGcpProjectId(): string {
  const fromEnv =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  if (fromEnv) return fromEnv;
  const appProjectId = admin.app().options.projectId;
  if (appProjectId) return appProjectId;
  throw new Error("Could not determine GCP project ID for Secret Manager access");
}

async function accessSecretVersion(secretName: string): Promise<string> {
  const client = getSecretManagerClient();
  const projectId = getGcpProjectId();
  // Always read the "latest" version. If the user rotates the secret, next cache miss picks up the new value.
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data;
  if (!payload) {
    throw new Error(`Secret ${secretName} has no payload data`);
  }
  return Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload);
}

export async function getCloudApiConfigForOrg(orgId?: string): Promise<CloudApiConfig> {
  const resolvedOrgId = orgId || getActiveOrgId();
  if (!resolvedOrgId) {
    throw new Error("No active orgId in request context; cannot load Cloud API config");
  }
  const db = getFirestore(admin.app(), DATABASE_ID);
  const configDoc = await db.doc(`organizations/${resolvedOrgId}/botConfig/config`).get();
  const data = configDoc.data();
  const cloudApiConfig = data?.cloudApiConfig as CloudApiConfig | undefined;
  if (!cloudApiConfig) {
    throw new Error(`Organization ${resolvedOrgId} does not have cloudApiConfig set in botConfig/config`);
  }
  if (!cloudApiConfig.accessTokenSecretName || !cloudApiConfig.phoneNumberId || !cloudApiConfig.wabaId) {
    throw new Error(
      `cloudApiConfig for ${resolvedOrgId} is incomplete (missing accessTokenSecretName, phoneNumberId or wabaId)`
    );
  }
  return cloudApiConfig;
}

/**
 * Load resolved credentials (Access Token dereferenced from Secret Manager) for the active org.
 * Cached for CREDENTIALS_CACHE_TTL_MS to avoid hitting Secret Manager on every message.
 */
export async function getCloudApiCredentials(orgId?: string): Promise<{
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  graphApiVersion: string;
  templates?: CloudApiTemplateNames;
}> {
  const resolvedOrgId = orgId || getActiveOrgId();
  if (!resolvedOrgId) {
    throw new Error("No active orgId in request context; cannot load Cloud API credentials");
  }
  const now = Date.now();
  const cached = credentialsCache[resolvedOrgId];
  if (cached && now < cached.expiry) {
    return {
      accessToken: cached.accessToken,
      phoneNumberId: cached.phoneNumberId,
      wabaId: cached.wabaId,
      graphApiVersion: cached.graphApiVersion,
      templates: cached.templates,
    };
  }

  const config = await getCloudApiConfigForOrg(resolvedOrgId);
  const accessToken = await accessSecretVersion(config.accessTokenSecretName);
  const graphApiVersion = config.graphApiVersion?.trim() || DEFAULT_GRAPH_API_VERSION;

  credentialsCache[resolvedOrgId] = {
    accessToken,
    phoneNumberId: config.phoneNumberId,
    wabaId: config.wabaId,
    graphApiVersion,
    templates: config.templates,
    expiry: now + CREDENTIALS_CACHE_TTL_MS,
  };

  return {
    accessToken,
    phoneNumberId: config.phoneNumberId,
    wabaId: config.wabaId,
    graphApiVersion,
    templates: config.templates,
  };
}

export function invalidateCloudApiCredentialsCache(orgId?: string): void {
  if (orgId) {
    delete credentialsCache[orgId];
  } else {
    for (const key of Object.keys(credentialsCache)) {
      delete credentialsCache[key];
    }
  }
}

// ==================== Phone number / chat ID helpers ====================

/**
 * Convert a raw chat ID / phone into the E.164-like digits-only form Meta expects in `to`.
 * Accepts inputs like "34911234567@s.whatsapp.net", "+34 911 234 567", "whatsapp:+34911234567".
 */
function toMetaPhoneNumber(input: string): string {
  const trimmed = input.replace(/^whatsapp:/i, "").trim();
  // Strip everything that isn't a digit (Meta expects digits only, no '+').
  const digitsPart = trimmed.split("@")[0].replace(/[^0-9]/g, "");
  if (!digitsPart) {
    throw new Error(`Cannot extract phone number from "${input}"`);
  }
  return digitsPart;
}

// ==================== Send text ====================

type SendTextParams = {
  to: string;
  body: string;
  chatId?: string;
};

type SendTextResult = {
  chatId: string;
  messageId?: string;
};

export async function sendText(params: SendTextParams): Promise<SendTextResult> {
  const { accessToken, phoneNumberId, graphApiVersion } = await getCloudApiCredentials();
  const to = toMetaPhoneNumber(params.to);

  const response = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: params.body },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = response.data as { messages?: Array<{ id?: string }> };
  return {
    chatId: params.chatId || params.to,
    messageId: data.messages?.[0]?.id,
  };
}

// ==================== Send template ====================

type SendTemplateParams = {
  to: string;
  chatId?: string;
  language: "es" | "en";
  variables: Record<string, string>;
  /** Explicit template name override. If omitted, caller should resolve from `cloudApiConfig.templates`. */
  templateName?: string;
  /** Optional header image URL (for templates that have a header IMAGE component). */
  mediaUrl?: string;
};

function buildTemplateLanguageCode(language: "es" | "en"): string {
  return language === "en" ? "en" : "es";
}

/**
 * Build `components[]` for a template call. Body variables are ordered by numeric key ("1","2",...).
 * Optional `mediaUrl` triggers a header IMAGE component.
 */
function buildTemplateComponents(
  variables: Record<string, string>,
  mediaUrl: string | undefined
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];

  if (mediaUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: mediaUrl } }],
    });
  }

  const orderedKeys = Object.keys(variables).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );
  if (orderedKeys.length > 0) {
    components.push({
      type: "body",
      parameters: orderedKeys.map((k) => ({ type: "text", text: variables[k] })),
    });
  }

  return components;
}

export async function sendTemplate(params: SendTemplateParams): Promise<SendTextResult> {
  if (!params.templateName) {
    throw new Error("sendTemplate: templateName is required (resolve from cloudApiConfig.templates)");
  }
  const { accessToken, phoneNumberId, graphApiVersion } = await getCloudApiCredentials();
  const to = toMetaPhoneNumber(params.to);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: buildTemplateLanguageCode(params.language) },
      components: buildTemplateComponents(params.variables, params.mediaUrl),
    },
  };

  const response = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = response.data as { messages?: Array<{ id?: string }> };
  return {
    chatId: params.chatId || params.to,
    messageId: data.messages?.[0]?.id,
  };
}

// ==================== 24h window fallback ====================

type SendTextWithTemplateFallbackParams = SendTextParams & {
  /** Template name used when outside the 24h customer-service window. */
  templateName?: string;
  /** Language used for the fallback template (default "es"). */
  templateLanguage?: "es" | "en";
  /** Log context. */
  context?: string;
};

function cloudApiErrorCode(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const code = error.response?.data?.error?.code;
  return typeof code === "number" ? code : undefined;
}

function cloudApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "";
  const message = error.response?.data?.error?.message;
  return typeof message === "string" ? message : "";
}

/**
 * Detect the "Message failed to send because more than 24 hours have passed..." class of errors.
 * Meta documents several codes in this area:
 *   131047 – re-engagement message (outside 24h) requires a template
 *   131026 – message undeliverable
 *   131051 – message type not currently supported / outside window
 */
export function isCloudApiOutside24hWindowError(error: unknown): boolean {
  const code = cloudApiErrorCode(error);
  if (code === 131047 || code === 131026 || code === 131051) return true;
  const message = cloudApiErrorMessage(error).toLowerCase();
  return (
    message.includes("24 hours") ||
    message.includes("re-engagement") ||
    (message.includes("template") && message.includes("required"))
  );
}

export async function sendTextWithTemplateFallback(
  params: SendTextWithTemplateFallbackParams
): Promise<SendTextResult & { usedTemplateFallback: boolean }> {
  try {
    const direct = await sendText(params);
    return { ...direct, usedTemplateFallback: false };
  } catch (error) {
    if (!isCloudApiOutside24hWindowError(error)) {
      throw error;
    }
    if (!params.templateName) {
      console.warn(
        `[cloud_api] Outside 24h window for ${params.to}${params.context ? ` (${params.context})` : ""}; ` +
          "no fallback templateName configured, cannot fallback to template."
      );
      throw error;
    }
    console.warn(
      `[cloud_api] Outside 24h window for ${params.to}${params.context ? ` (${params.context})` : ""}; ` +
        `retrying with template ${params.templateName}.`
    );
    const fallback = await sendTemplate({
      to: params.to,
      chatId: params.chatId,
      language: params.templateLanguage || "es",
      templateName: params.templateName,
      variables: { "1": params.body },
    });
    return { ...fallback, usedTemplateFallback: true };
  }
}

// ==================== Template creation ====================

export type CreateTemplateComponent =
  | { type: "HEADER"; format: "TEXT" | "IMAGE"; text?: string; example?: Record<string, unknown> }
  | { type: "BODY"; text: string; example?: { body_text?: string[][] } }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: Array<Record<string, unknown>> };

export type CreateTemplateParams = {
  name: string;
  /** UTILITY is sufficient for confirmations / notifications; MARKETING requires more strict approval. */
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string; // e.g. "es", "en"
  components: CreateTemplateComponent[];
};

/**
 * Create a message template via Meta's `/{WABA_ID}/message_templates` endpoint.
 * Returns the raw response which typically includes `{ id, status, category }`.
 */
export async function createMessageTemplate(params: CreateTemplateParams): Promise<{
  id: string;
  status: string;
  category?: string;
}> {
  const { accessToken, wabaId, graphApiVersion } = await getCloudApiCredentials();

  const response = await axios.post(
    `https://graph.facebook.com/${graphApiVersion}/${wabaId}/message_templates`,
    {
      name: params.name,
      category: params.category,
      language: params.language,
      components: params.components,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = response.data as { id?: string; status?: string; category?: string };
  if (!data?.id) {
    throw new Error("Meta Cloud API did not return template id");
  }
  return {
    id: data.id,
    status: data.status || "PENDING",
    category: data.category,
  };
}

// ==================== Health check ====================

export async function checkCloudApiHealth(orgId?: string): Promise<{ status: string; details?: any }> {
  try {
    const { accessToken, phoneNumberId, graphApiVersion } = await getCloudApiCredentials(orgId);
    const response = await axios.get(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      }
    );
    return { status: "ok", details: response.data };
  } catch (error: any) {
    const details = axios.isAxiosError(error) ? error.response?.data || error.message : error.message;
    console.error("Cloud API health check failed:", details);
    return { status: "error", details };
  }
}

// ==================== Inbound webhook parsing ====================

export type CloudApiInboundMessage = {
  chatId: string;
  phone: string;
  text: string;
  timestamp: number;
  /** Meta message id (wamid...). */
  messageId?: string;
  /** Meta phone_number_id that received the message. Useful for debugging. */
  phoneNumberId?: string;
};

/**
 * Parse a Meta Cloud API webhook POST body into our internal shape.
 * Non-text messages (media/interactive/status) are ignored for now — this mirrors how Twilio/Whapi
 * are handled in the rest of the codebase.
 *
 * Payload shape (Meta):
 *   { object, entry: [{ id, changes: [{ value: { messaging_product, metadata: { phone_number_id },
 *     contacts, messages: [{ from, id, timestamp, type, text: { body }, ... }], statuses }, field }] }] }
 */
export function parseCloudApiWebhook(
  body: unknown,
  normalizeChatId: (phone: string) => string,
  ensureTimestampMillis: (ts: number) => number
): CloudApiInboundMessage[] {
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const result: CloudApiInboundMessage[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as Record<string, unknown>).changes)
      ? ((entry as Record<string, unknown>).changes as unknown[])
      : [];

    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
      if (!value) continue;

      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId =
        metadata && typeof metadata.phone_number_id === "string" ? metadata.phone_number_id : undefined;

      const messages = Array.isArray(value.messages) ? (value.messages as unknown[]) : [];
      for (const raw of messages) {
        if (!raw || typeof raw !== "object") continue;
        const msg = raw as Record<string, unknown>;
        if (msg.type !== "text") continue; // only handle plain text for now
        const from = typeof msg.from === "string" ? msg.from : "";
        const textObj = msg.text as Record<string, unknown> | undefined;
        const text = typeof textObj?.body === "string" ? (textObj.body as string) : "";
        if (!from || !text) continue;

        const tsRaw = msg.timestamp;
        const tsNum =
          typeof tsRaw === "number"
            ? tsRaw
            : typeof tsRaw === "string"
            ? Number.parseInt(tsRaw, 10)
            : Number.NaN;
        const timestamp = ensureTimestampMillis(Number.isFinite(tsNum) ? tsNum : Date.now());

        const phone = from.replace(/[^0-9]/g, "");
        const chatId = normalizeChatId(phone);

        result.push({
          chatId,
          phone,
          text,
          timestamp,
          messageId: typeof msg.id === "string" ? msg.id : undefined,
          phoneNumberId,
        });
      }
    }
  }

  return result;
}
