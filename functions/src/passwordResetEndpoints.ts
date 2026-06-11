import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { APP_BASE_URL } from "./appConfig";
import { sendPasswordResetNotification } from "./services/emailService";
import { applyAllowlistedCors } from "./utils/cors";
import { clientIpKey, enforceRateLimit } from "./utils/rateLimit";

function setCors(req: Request, res: Response): void {
  applyAllowlistedCors(req, res, {
    methods: "POST, OPTIONS",
    headers: "Content-Type",
  });
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function passwordResetRequestHandler(req: Request, res: Response): Promise<void> {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const ipHash = clientIpKey(req);
  const ipLimit = await enforceRateLimit(db, `passwordReset:ip:${ipHash}`, {
    windowSec: 15 * 60,
    max: 5,
  });
  if (!ipLimit.allowed) {
    res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
    // Return 200 to avoid leaking rate-limit info that could aid enumeration
    res.status(200).json({ status: "sent" });
    return;
  }

  const body = (req.body || {}) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }

  // Always respond 200 regardless of whether the account exists (no enumeration)
  try {
    const base = APP_BASE_URL.value().trim().replace(/\/+$/, "");
    const continueUrl = `${base}/login`;

    const resetUrl = await getAuth().generatePasswordResetLink(email, {
      url: continueUrl,
    });

    await sendPasswordResetNotification(email, resetUrl);
  } catch (e) {
    // Log server-side but never surface to the client
    console.error("passwordResetRequest error", e);
  }

  res.status(200).json({ status: "sent" });
}
