import axios from "axios";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// Backfill for inbound WhatsApp messages dropped between 2026-06-08T12:15:56Z
// (deploy that added master-token-only signature verification to the inbound
// webhook) and the fix that verifies against per-org subaccount tokens.
//
// Twilio kept the messages (error 11200 just means our webhook answered 401),
// so we list them from each org's subaccount via the Messages API and replay
// the missing ones through the production twilioWebhook with a valid
// X-Twilio-Signature computed from the subaccount auth token. The normal
// pipeline (buffering, conversation state, bot reply) takes over from there.
//
// Run:
//   npm run build && node lib/scripts/backfill_dropped_twilio_inbound.js            # dry run
//   npm run build && node lib/scripts/backfill_dropped_twilio_inbound.js --execute  # replay
//   ... --org=<orgId>      limit to one org
//   ... --since=<ISO date> override the cutoff
//
// Replays are idempotent: the webhook stores history entries keyed by
// `${timestamp}:${text}` and we pass the original Twilio date_sent as the
// Timestamp field, so a second run (or a message that was already processed)
// is detected in the dedup pass and skipped.

const PROJECT_ID = "real-estate-idealista-bot";
const DATABASE_ID = "realestate-whatsapp-bot";
// Post to the direct Cloud Run URL (with trailing slash). This is the string
// reconstructRequestUrl produces inside the function, so the signature we
// compute over it matches what the webhook expects. Posting to the
// cloudfunctions.net proxy URL would fail signature verification (host + path
// are rewritten before the function sees the request).
const WEBHOOK_URL = "https://twiliowebhook-qewb2jyema-ew.a.run.app/";

const EXECUTE = process.argv.includes("--execute");
const ORG_FILTER = (process.argv.find((a) => a.startsWith("--org=")) || "").replace("--org=", "");
const SINCE_ARG = (process.argv.find((a) => a.startsWith("--since=")) || "").replace("--since=", "");
const CUTOFF_MS = Date.parse(SINCE_ARG || "2026-06-08T12:15:56Z");

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = getFirestore(admin.app(), DATABASE_ID);
const sm = new SecretManagerServiceClient();

type OrgTwilio = {
  orgId: string;
  accountSid: string;
  whatsappNumber: string;
  authToken: string;
};

type TwilioMessage = {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  body: string;
  direction: string;
  status: string;
  num_media: string;
  date_sent: string | null;
  date_created: string | null;
};

type HistoryEntry = { role?: string; text?: string; timestamp?: number };

async function accessSecretLatest(secretId: string): Promise<string> {
  const [version] = await sm.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretId}/versions/latest`,
  });
  const payload = version.payload?.data;
  if (!payload) throw new Error(`Secret ${secretId} has no payload`);
  return (Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload)).trim();
}

/** Same algorithm as Twilio (and verifyTwilioSignature in index.ts). */
function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

function bareDigits(whatsappAddr: string): string {
  return whatsappAddr.replace(/^whatsapp:/, "").replace(/^\+/, "");
}

async function loadOrgs(): Promise<OrgTwilio[]> {
  const out: OrgTwilio[] = [];
  const orgsSnap = await db.collection("organizations").get();
  for (const orgDoc of orgsSnap.docs) {
    if (ORG_FILTER && orgDoc.id !== ORG_FILTER) continue;
    const cfgSnap = await db.doc(`organizations/${orgDoc.id}/botConfig/config`).get();
    const cfg = cfgSnap.data() as
      | { twilioConfig?: { accountSid?: string; whatsappNumber?: string; authTokenSecretName?: string } }
      | undefined;
    const accountSid = cfg?.twilioConfig?.accountSid?.trim();
    const whatsappNumber = cfg?.twilioConfig?.whatsappNumber?.trim();
    const secretName = cfg?.twilioConfig?.authTokenSecretName?.trim();
    // Orgs without a per-org secret are on the master account; their webhooks
    // verified fine throughout, nothing to backfill.
    if (!accountSid || !whatsappNumber || !secretName) continue;
    try {
      const authToken = await accessSecretLatest(secretName);
      if (!authToken) throw new Error("empty token");
      out.push({ orgId: orgDoc.id, accountSid, whatsappNumber, authToken });
    } catch (error) {
      console.warn(`[${orgDoc.id}] cannot read secret ${secretName}: ${(error as Error).message}`);
    }
  }
  return out;
}

/** WhatsApp address Twilio stamps on the message record, regardless of how the
 * number is stored in botConfig (some orgs omit the `whatsapp:` prefix). */
function whatsappAddr(number: string): string {
  return `whatsapp:+${number.replace(/^whatsapp:/, "").replace(/^\+/, "")}`;
}

async function listInboundSince(org: OrgTwilio): Promise<TwilioMessage[]> {
  // Twilio returns newest-first. We page until a message predates the cutoff,
  // then stop — robust against date-filter formatting and efficient.
  const to = whatsappAddr(org.whatsappNumber);
  const out: TwilioMessage[] = [];
  let url: string | null =
    `https://api.twilio.com/2010-04-01/Accounts/${org.accountSid}/Messages.json` +
    `?PageSize=100&To=${encodeURIComponent(to)}`;
  let reachedCutoff = false;
  while (url && !reachedCutoff) {
    const resp: { data: { messages: TwilioMessage[]; next_page_uri?: string | null } } = await axios.get(url, {
      auth: { username: org.accountSid, password: org.authToken },
    });
    const page = resp.data.messages || [];
    for (const m of page) {
      const sentMs = Date.parse(m.date_sent || m.date_created || "");
      if (Number.isFinite(sentMs) && sentMs < CUTOFF_MS) {
        reachedCutoff = true;
        break;
      }
      if (m.direction !== "inbound") continue;
      if (!m.body || !m.body.trim()) continue; // media-only; extractInboundMessages drops these
      out.push(m);
    }
    url = resp.data.next_page_uri ? `https://api.twilio.com${resp.data.next_page_uri}` : null;
  }
  return out;
}

/** True when the conversation history already holds this inbound (it was processed). */
function alreadyInHistory(history: HistoryEntry[], text: string, sentMs: number): boolean {
  const needle = text.trim();
  return history.some((h) => {
    if (h?.role !== "user" || typeof h.text !== "string") return false;
    if (h.text.trim() !== needle) return false;
    const ts = typeof h.timestamp === "number" ? h.timestamp : NaN;
    // Exact match = a prior replay; ±20 min window = processed on live receipt
    // (live receipt stamps Date.now(), which trails date_sent slightly).
    return ts === sentMs || Math.abs(ts - sentMs) < 20 * 60 * 1000;
  });
}

async function replayMessage(org: OrgTwilio, msg: TwilioMessage): Promise<void> {
  const sentMs = Date.parse(msg.date_sent || msg.date_created || "") || Date.now();
  const params: Record<string, string> = {
    SmsSid: msg.sid,
    MessageSid: msg.sid,
    AccountSid: msg.account_sid,
    From: msg.from,
    To: msg.to,
    Body: msg.body,
    WaId: bareDigits(msg.from),
    NumMedia: msg.num_media || "0",
    Timestamp: new Date(sentMs).toISOString(),
  };
  const signature = computeTwilioSignature(org.authToken, WEBHOOK_URL, params);
  const form = new URLSearchParams(params);
  const resp = await axios.post(WEBHOOK_URL, form.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    validateStatus: () => true,
  });
  if (resp.status !== 200) {
    throw new Error(`webhook returned ${resp.status}: ${JSON.stringify(resp.data).slice(0, 300)}`);
  }
}

/** Signed no-op POST (no SmsSid → "No messages to process") proving the
 * webhook accepts our subaccount-token signature before we replay for real. */
async function probeSignature(org: OrgTwilio): Promise<boolean> {
  const params: Record<string, string> = { To: org.whatsappNumber, BackfillProbe: "1" };
  const signature = computeTwilioSignature(org.authToken, WEBHOOK_URL, params);
  const resp = await axios.post(WEBHOOK_URL, new URLSearchParams(params).toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    validateStatus: () => true,
  });
  console.log(`[probe ${org.orgId}] webhook answered ${resp.status} ${JSON.stringify(resp.data).slice(0, 120)}`);
  return resp.status === 200;
}

async function main(): Promise<void> {
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "dry-run"} | cutoff: ${new Date(CUTOFF_MS).toISOString()}`);
  const orgs = await loadOrgs();
  console.log(`Subaccount orgs found: ${orgs.length}`);

  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  let totalDropped = 0;
  let totalReplayed = 0;
  let inWindowChats = 0;
  let staleChats = 0;
  let probedOk = false;

  for (const org of orgs) {
    let inbound: TwilioMessage[];
    try {
      inbound = await listInboundSince(org);
    } catch (error) {
      console.warn(`[${org.orgId}] Twilio list failed: ${(error as Error).message}`);
      continue;
    }
    if (inbound.length === 0) {
      console.log(`[${org.orgId}] no inbound since cutoff`);
      continue;
    }

    // Group per chat, oldest first, and dedup against conversation history.
    const byChat = new Map<string, TwilioMessage[]>();
    for (const m of inbound) {
      const chatId = `${bareDigits(m.from)}@s.whatsapp.net`;
      (byChat.get(chatId) || byChat.set(chatId, []).get(chatId)!).push(m);
    }

    for (const [chatId, msgs] of byChat) {
      msgs.sort((a, b) => Date.parse(a.date_sent || "") - Date.parse(b.date_sent || ""));
      const convSnap = await db.doc(`organizations/${org.orgId}/conversations/${chatId}`).get();
      const history = (convSnap.data()?.history || []) as HistoryEntry[];
      const missing = msgs.filter((m) => !alreadyInHistory(history, m.body, Date.parse(m.date_sent || "")));
      if (missing.length === 0) continue;
      totalDropped += missing.length;

      // The bot can only send a freeform reply if the lead's most recent
      // inbound is within WhatsApp's 24h customer-care window. Older chats
      // still get their history restored, but the reply won't deliver.
      const latestMs = Math.max(...msgs.map((m) => Date.parse(m.date_sent || "") || 0));
      const inWindow = nowMs - latestMs < WINDOW_MS;
      if (inWindow) inWindowChats += 1;
      else staleChats += 1;

      for (const m of missing) {
        console.log(
          `[${org.orgId}] ${chatId} ${m.date_sent} ${inWindow ? "[reply-window OPEN]" : "[reply-window CLOSED]"} ` +
          `"${m.body.slice(0, 60).replace(/\n/g, " ")}"` +
          (EXECUTE ? "" : " (dry-run)")
        );
        if (!EXECUTE) continue;
        if (!probedOk) {
          if (!(await probeSignature(org))) {
            throw new Error("Signature probe failed — webhook rejected subaccount-signed request; aborting replay");
          }
          probedOk = true;
        }
        try {
          await replayMessage(org, m);
          totalReplayed += 1;
          await new Promise((r) => setTimeout(r, 750));
        } catch (error) {
          console.error(`[${org.orgId}] replay failed for ${m.sid}: ${(error as Error).message}`);
        }
      }
    }
  }

  console.log(`\nDropped messages found: ${totalDropped}`);
  console.log(`Chats with reply window OPEN (bot can reply now): ${inWindowChats}`);
  console.log(`Chats with reply window CLOSED (history restored only): ${staleChats}`);
  if (EXECUTE) console.log(`Replayed successfully: ${totalReplayed}`);
  else console.log("Dry run — re-run with --execute to replay.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
