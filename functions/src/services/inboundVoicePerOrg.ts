/**
 * Per-org inbound voice flow (no-handoff) — pure helpers.
 *
 * Context: historically every inbound call landed on a single global "intake" org
 * (PROPLEAD_INTAKE_ORG_ID), which searched ALL orgs' listings and then performed a
 * cross-org HANDOFF to the listing owner. In the new model, each org has its OWN
 * dedicated voice number, so the destination org is known from the dialed number
 * (Twilio `To`) — only the listing is unknown. This module holds the small, pure
 * helpers the new flow needs; the Cloud Function entrypoints stay in index.ts so the
 * legacy intake+handoff path remains untouched as a fallback.
 *
 * The legacy resolver `resolveOrgIdByTwilioToNumber` (index.ts) maps the org's
 * WhatsApp number; the dedicated voice number is a SEPARATE field
 * (twilioConfig.voiceNumber) resolved here.
 */
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import type { BotConfig } from "../types";

const DATABASE_ID = "realestate-whatsapp-bot";

/**
 * Normalize any phone representation to digits-only E.164 (no `+`, no `whatsapp:`),
 * matching the `displayPhoneNumber` / `voiceNumber` storage convention (e.g. "34911223344").
 * Twilio Voice sends `To` as `+34911...`; this also tolerates a stray `whatsapp:` prefix.
 */
export function normalizeVoiceE164(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().toLowerCase().replace(/^whatsapp:/, "");
  return trimmed.replace(/\D/g, "");
}

/**
 * Resolve the org that owns a dedicated inbound-voice number.
 *
 * Index-first (O(1)) with a linear-scan fallback:
 *  1. Read `voiceNumberIndex/{e164}`; if present, VALIDATE the org's current
 *     twilioConfig.voiceNumber still matches before trusting it (guards against a
 *     stale index doc left behind when a number was reassigned).
 *  2. If there's no usable index hit, scan all `organizations/*` / botConfig/config
 *     and compare normalized `twilioConfig.voiceNumber`. Same per-call cost as the
 *     existing WhatsApp resolver; guarantees correctness even before the index is
 *     backfilled or if a write failed.
 *
 * Returns the orgId, or undefined when no org claims the number.
 */
export async function resolveOrgIdByVoiceNumber(toRaw: unknown): Promise<string | undefined> {
  const key = normalizeVoiceE164(toRaw);
  if (!key) return undefined;
  const db = getFirestore(admin.app(), DATABASE_ID);

  // 1) Index-first, validated against the org's current config.
  try {
    const idxSnap = await db.doc(`voiceNumberIndex/${key}`).get();
    const indexedOrgId = idxSnap.exists ? (idxSnap.data()?.orgId as string | undefined) : undefined;
    if (indexedOrgId) {
      const cfgSnap = await db.doc(`organizations/${indexedOrgId}/botConfig/config`).get();
      const cfg = cfgSnap.exists ? (cfgSnap.data() as Partial<BotConfig> | undefined) : undefined;
      if (cfg && normalizeVoiceE164(cfg.twilioConfig?.voiceNumber) === key) {
        return indexedOrgId;
      }
      // Stale index hit: fall through to the scan to find the real owner (if any).
    }
  } catch (err) {
    console.warn("resolveOrgIdByVoiceNumber: index read failed, falling back to scan", err);
  }

  // 2) Linear-scan fallback.
  const orgsSnap = await db.collection("organizations").get();
  for (const orgDoc of orgsSnap.docs) {
    const cfgSnap = await db.doc(`organizations/${orgDoc.id}/botConfig/config`).get();
    if (!cfgSnap.exists) continue;
    const cfg = cfgSnap.data() as Partial<BotConfig> | undefined;
    if (normalizeVoiceE164(cfg?.twilioConfig?.voiceNumber) === key) {
      return orgDoc.id;
    }
  }
  return undefined;
}

/**
 * Build the "I think I found it" continuation the bot sends once the listing is
 * resolved in the per-org flow. Replaces the legacy "Hola, soy X..." intro (the
 * opt-in template already greeted the lead). `features` must already be the
 * language-resolved, formatted bullet list. Qualification (PASO 1) handles the name,
 * so no name step here.
 */
export function composeListingFoundMessage(params: {
  language: "es" | "en";
  link: string;
  features: string;
  leadName?: string;
}): string {
  const { language, link, features, leadName } = params;
  const name = (leadName || "").trim();
  const lines: string[] = language === "en"
    ? [
        name ? `Hi ${name}!` : "",
        "Great! I think I've found it 👇",
        "",
        link,
        "",
        "Have you seen the property highlights?",
        features,
      ]
    : [
        name ? `¡Hola ${name}!` : "",
        "¡Estupendo! Creo que ya lo he encontrado 👇",
        "",
        link,
        "",
        "¿Has visto las características de la vivienda?",
        features,
      ];
  // Collapse blank lines (same behavior as index.ts compactMessage).
  const normalized: string[] = [];
  for (const line of lines) {
    if (line === "" && normalized[normalized.length - 1] === "") continue;
    normalized.push(line);
  }
  while (normalized[0] === "") normalized.shift();
  while (normalized[normalized.length - 1] === "") normalized.pop();
  return normalized.join("\n");
}
