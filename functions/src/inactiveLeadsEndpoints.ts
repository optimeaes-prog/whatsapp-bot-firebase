import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import { INACTIVE_LEADS_SECRET } from "./inactiveLeadsParams";
import { listInactiveSalesLeads } from "./services/inactiveLeadsService";
import { verifyInactiveLeadsToken } from "./services/inactiveLeadsToken";
import { clientIpKey, enforceRateLimit } from "./utils/rateLimit";

const RL_DB_ID = "realestate-whatsapp-bot";

// Per-IP cap on token verifications. The tokens are HMAC-signed so they aren't
// blindly guessable, but this stops anyone probing for old/leaked links at scale.
async function enforceInactiveLeadsIpLimit(req: Request): Promise<{ ok: boolean; retryAfterSec: number }> {
  const ipHash = clientIpKey(req);
  const result = await enforceRateLimit(
    getFirestore(admin.app(), RL_DB_ID),
    `inactiveLeads:ip:${ipHash}`,
    { windowSec: 60, max: 20 }
  );
  return { ok: result.allowed, retryAfterSec: result.retryAfterSec };
}

function readToken(req: Request): string {
  const q = req.query.token;
  return typeof q === "string" ? q.trim() : "";
}

/**
 * JSON API behind the public "leads sin respuesta" page: GET ?token=
 *
 * The token is the only credential — it carries the orgId, so the caller can
 * never widen the query to another agency's leads. Read-only.
 */
export async function inactiveLeadsApiHandler(req: Request, res: Response): Promise<void> {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  let secret: string;
  try {
    secret = INACTIVE_LEADS_SECRET.value().trim();
  } catch {
    res.status(503).json({ error: "not_configured" });
    return;
  }
  if (!secret) {
    res.status(503).json({ error: "not_configured" });
    return;
  }

  const token = readToken(req);
  if (!token) {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  const ipLimit = await enforceInactiveLeadsIpLimit(req);
  if (!ipLimit.ok) {
    res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const verified = verifyInactiveLeadsToken(token, secret);
  if (!verified) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  try {
    const nowMs = Date.now();
    const leads = await listInactiveSalesLeads(verified.orgId, nowMs);
    res.status(200).json({
      generatedAtMs: nowMs,
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        listingDescription: lead.listingDescription,
        listingCode: lead.listingCode,
        lastMessageAtMs: lead.lastMessageAtMs,
      })),
    });
  } catch (e) {
    console.error("[inactiveLeads] query failed", { orgTail: verified.orgId.slice(-8), error: e });
    res.status(500).json({ error: "query_failed" });
  }
}
