import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import { EMAIL_UNSUBSCRIBE_SECRET } from "./emailUnsubscribeParams";
import { getOptionalEmailOptOut, setOptionalEmailOptOut } from "./services/emailCommunicationPreferencesDb";
import { verifyEmailPrefsToken } from "./services/emailPreferenceToken";
import { clientIpKey, enforceRateLimit } from "./utils/rateLimit";

const RL_DB_ID = "realestate-whatsapp-bot";

// Per-IP cap on HMAC verifications. Even though tokens are HMAC-signed with a
// per-deployment secret (i.e. not blindly brute-forceable), capping per-IP
// stops a botnet from probing for old/leaked tokens at scale.
async function enforceEmailPrefsIpLimit(req: Request, label: string): Promise<{ ok: boolean; retryAfterSec: number }> {
  const ipHash = clientIpKey(req);
  const result = await enforceRateLimit(
    getFirestore(admin.app(), RL_DB_ID),
    `emailPrefs:${label}:ip:${ipHash}`,
    { windowSec: 60, max: 20 }
  );
  return { ok: result.allowed, retryAfterSec: result.retryAfterSec };
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readToken(req: Request): string {
  const q = req.query.token;
  return typeof q === "string" ? q.trim() : "";
}

export async function emailPreferencesApiHandler(req: Request, res: Response): Promise<void> {
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  let secret: string;
  try {
    secret = EMAIL_UNSUBSCRIBE_SECRET.value().trim();
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

  const ipLimit = await enforceEmailPrefsIpLimit(req, "api");
  if (!ipLimit.ok) {
    res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const verified = verifyEmailPrefsToken(token, secret);
  if (!verified) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  let action = typeof req.query.action === "string" ? req.query.action : "status";
  if (req.method === "POST" && req.body && typeof req.body === "object" && typeof (req.body as { action?: string }).action === "string") {
    action = (req.body as { action: string }).action;
  }

  try {
    if (action === "status") {
      const optedOut = await getOptionalEmailOptOut(verified.email);
      res.status(200).json({ optedOut, emailMasked: maskEmail(verified.email) });
      return;
    }
    if (action === "unsubscribe") {
      await setOptionalEmailOptOut(verified.email, true);
      res.status(200).json({ ok: true, optedOut: true });
      return;
    }
    if (action === "resubscribe") {
      await setOptionalEmailOptOut(verified.email, false);
      res.status(200).json({ ok: true, optedOut: false });
      return;
    }
    res.status(400).json({ error: "bad_action" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

export async function emailUnsubscribeHandler(req: Request, res: Response): Promise<void> {
  res.set("Cache-Control", "no-store");

  let secret: string;
  try {
    secret = EMAIL_UNSUBSCRIBE_SECRET.value().trim();
  } catch {
    res.status(503).set("Content-Type", "text/html; charset=utf-8").send("<p>No disponible.</p>");
    return;
  }
  if (!secret) {
    res.status(503).set("Content-Type", "text/html; charset=utf-8").send("<p>No disponible.</p>");
    return;
  }

  const token = readToken(req);
  if (!token) {
    res.status(400).set("Content-Type", "text/html; charset=utf-8").send("<p>Enlace no válido.</p>");
    return;
  }

  const ipLimit = await enforceEmailPrefsIpLimit(req, "unsub");
  if (!ipLimit.ok) {
    res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
    res.status(429).set("Content-Type", "text/html; charset=utf-8").send("<p>Demasiadas peticiones, vuelve a intentarlo en un minuto.</p>");
    return;
  }

  const verified = verifyEmailPrefsToken(token, secret);
  if (!verified) {
    res.status(400).set("Content-Type", "text/html; charset=utf-8").send("<p>Enlace caducado o no válido.</p>");
    return;
  }

  const confirmRaw = req.query.confirm;
  const confirm = confirmRaw === "1" || confirmRaw === "true";

  const safeToken = encodeURIComponent(token);
  const confirmUrl = `https://proplead.io/api/email-unsubscribe?token=${safeToken}&confirm=1`;

  if (!confirm) {
    const page = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Baja</title></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F8FAFC;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:24px;">
    <p style="margin:0 0 12px;">Confirma que quieres dejar de recibir correos opcionales de Proplead para <span style="font-weight:700;">${htmlEscape(maskEmail(verified.email))}</span>.</p>
    <p style="margin:0;"><a href="${confirmUrl}" style="display:inline-block;background:#0F172A;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;">Confirmar baja</a></p>
    <p style="margin:16px 0 0;font-size:13px;color:#64748B;">Seguirás recibiendo correos necesarios para el servicio (facturación, seguridad, etc.).</p>
  </div>
</body></html>`;
    res.status(200).set("Content-Type", "text/html; charset=utf-8").send(page);
    return;
  }

  try {
    await setOptionalEmailOptOut(verified.email, true);
    const ok = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Listo</title></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F8FAFC;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:24px;">
    <p style="margin:0 0 8px;font-weight:800;">Te has dado de baja</p>
    <p style="margin:0;color:#64748B;">Ya no te enviaremos correos opcionales a <span style="font-weight:700;">${htmlEscape(maskEmail(verified.email))}</span>. Puedes volver a activarlos desde tus preferencias si lo cambias de opinión.</p>
    <p style="margin:16px 0 0;"><a href="https://proplead.io/email-preferences?t=${safeToken}" style="color:#0F172A;">Ir a preferencias</a></p>
  </div>
</body></html>`;
    res.status(200).set("Content-Type", "text/html; charset=utf-8").send(ok);
  } catch (e) {
    res.status(500).set("Content-Type", "text/html; charset=utf-8").send("<p>Error al procesar la baja.</p>");
  }
}
