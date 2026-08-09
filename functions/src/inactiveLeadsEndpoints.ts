import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import { INACTIVE_LEADS_SECRET } from "./inactiveLeadsParams";
import { markLeadHandled, unmarkLeadHandled } from "./services/inactiveLeadsHandled";
import { resolveInactiveLeadsLink } from "./services/inactiveLeadsLinks";
import { listInactiveSalesLeads, resolveAgentNames } from "./services/inactiveLeadsService";
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

/** Código del enlace corto (proplead.io/leads-inactivos/<code>). */
function readCode(req: Request): string {
  const q = req.query.code;
  return typeof q === "string" ? q.trim() : "";
}

/**
 * POST: marca o desmarca un lead como "Contactado".
 *
 * Quién puede hacerlo sale del token, no del cuerpo de la petición: la
 * organización siempre, y el agente solo sus propios leads.
 */
async function handleMarkRequest(
  req: Request,
  res: Response,
  verified: { orgId: string; agentUid: string }
): Promise<void> {
  const body = (req.body || {}) as { action?: unknown; leadId?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";

  if (!leadId) {
    res.status(400).json({ error: "missing_lead" });
    return;
  }
  if (action !== "handled" && action !== "undo") {
    res.status(400).json({ error: "bad_action" });
    return;
  }

  try {
    const result =
      action === "handled"
        ? await markLeadHandled({
            orgId: verified.orgId,
            leadId,
            agentUid: verified.agentUid,
            nowMs: Date.now(),
          })
        : await unmarkLeadHandled({
            orgId: verified.orgId,
            leadId,
            agentUid: verified.agentUid,
          });

    if (!result.ok) {
      res.status(result.reason === "forbidden" ? 403 : 404).json({ error: result.reason });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[inactiveLeads] mark failed", { orgTail: verified.orgId.slice(-8), action, error: e });
    res.status(500).json({ error: "mark_failed" });
  }
}

/**
 * JSON API behind the public "leads sin respuesta" page.
 *
 * - GET  → la lista.
 * - POST → marcar (o desmarcar) un lead como "Contactado".
 *
 * El token es la única credencial y lleva dentro la organización, así que quien
 * abre el enlace no puede pedir los leads de otra agencia ni marcar los de
 * otra. Si además lleva agente, solo puede tocar los suyos.
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

  // `code` es el enlace corto; `token` sigue valiendo para los enlaces largos
  // que ya se hayan enviado y para el script de pruebas.
  const code = readCode(req);
  const directToken = readToken(req);
  if (!code && !directToken) {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  // Antes de tocar Firestore: adivinar códigos es justo el ataque que el límite
  // por IP tiene que frenar.
  const ipLimit = await enforceInactiveLeadsIpLimit(req);
  if (!ipLimit.ok) {
    res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const token = code ? await resolveInactiveLeadsLink(code) : directToken;
  if (!token) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  // El código solo apunta al token; quien decide organización, agente y
  // caducidad sigue siendo la firma.
  const verified = verifyInactiveLeadsToken(token, secret);
  if (!verified) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  if (req.method === "POST") {
    await handleMarkRequest(req, res, verified);
    return;
  }

  try {
    const nowMs = Date.now();
    const leads = await listInactiveSalesLeads(verified.orgId, nowMs, {
      agentUid: verified.agentUid,
    });

    // El enlace de un agente ya es todo suyo: poner su nombre en cada fila solo
    // ocuparía sitio. En el de la agencia sí hace falta saber de quién es cada lead.
    const scopedToAgent = Boolean(verified.agentUid);
    const agentNames = scopedToAgent
      ? new Map<string, string>()
      : await resolveAgentNames(verified.orgId, leads.map((lead) => lead.assignedAgentUid));

    res.status(200).json({
      generatedAtMs: nowMs,
      scopedToAgent,
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        listingDescription: lead.listingDescription,
        listingCode: lead.listingCode,
        lastMessageAtMs: lead.lastMessageAtMs,
        messageCount: lead.messageCount,
        recentMessages: lead.recentMessages,
        ...(scopedToAgent
          ? {}
          : { agentName: agentNames.get(lead.assignedAgentUid) || "" }),
      })),
    });
  } catch (e) {
    console.error("[inactiveLeads] query failed", { orgTail: verified.orgId.slice(-8), error: e });
    res.status(500).json({ error: "query_failed" });
  }
}
