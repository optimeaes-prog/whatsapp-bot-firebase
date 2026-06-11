import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import { organizationDisplayNameFromOrgDoc } from "../utils/organizationDisplayName";
import {
  formatWelcomeEmail,
  formatLowBalanceEmail,
  formatPaymentFailedEmail,
  formatInvitationEmail,
  formatPasswordResetEmail,
  formatNewSignupAlertEmail,
  renderSupportInquiryEmail,
} from "./emailTemplates";

import { EMAIL_UNSUBSCRIBE_SECRET } from "../emailUnsubscribeParams";
import { TWILIO_API_KEY, TWILIO_API_SECRET } from "../secrets";
import { signEmailPrefsToken } from "./emailPreferenceToken";
import { APP_BASE_URL, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME } from "../appConfig";

const PROPLEAD_DB_NAME = "realestate-whatsapp-bot";

function buildWelcomeEmailPreferenceLinks(
  toEmail: string
): { preferencesUrl: string; unsubscribeUrl: string } | undefined {
  try {
    const secret = EMAIL_UNSUBSCRIBE_SECRET.value().trim();
    const base = APP_BASE_URL.value().trim().replace(/\/+$/, "");
    if (!secret) return undefined;
    if (!base) return undefined;
    const token = signEmailPrefsToken(toEmail, secret);
    const enc = encodeURIComponent(token);
    return {
      preferencesUrl: `${base}/email-preferences?t=${enc}`,
      unsubscribeUrl: `${base}/api/email-unsubscribe?token=${enc}&confirm=1`,
    };
  } catch (err) {
    console.error("[email] buildWelcomeEmailPreferenceLinks failed:", err);
    return undefined;
  }
}

/**
 * Unified Email Service — sends via Twilio's SendGrid Email API
 * (POST https://comms.twilio.com/v1/Emails) using Basic Auth with
 * TWILIO_API_KEY / TWILIO_API_SECRET. Sender domain must be authenticated
 * in the Twilio/SendGrid console.
 */
export async function sendEmailToUser(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const apiKeySid = TWILIO_API_KEY.value();
  const apiKeySecret = TWILIO_API_SECRET.value();
  if (!apiKeySid || !apiKeySecret) {
    console.warn("Twilio API key secrets are not set. Skipping email sending.");
    return;
  }

  try {
    const fromAddress = EMAIL_FROM_ADDRESS.value().trim() || "noreply@proplead.io";
    const fromName = EMAIL_FROM_NAME.value().trim() || "Proplead";
    const credentials = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");

    const body: Record<string, unknown> = {
      from: { address: fromAddress, name: fromName },
      to: [{ address: params.to }],
      content: { subject: params.subject, html: params.html },
    };
    // NOTE: Twilio Email API rejects both `reply_to` and `reply_to_emails` in
    // the shapes we've tried. Dropping replyTo support until we confirm the
    // correct field shape. Callers that need replies can render the address
    // in the body instead.

    const response = await fetch("https://comms.twilio.com/v1/Emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twilio Email API error ${response.status}: ${text}`);
    }

    console.log(`Email sent successfully to ${params.to}: ${params.subject}`);
  } catch (error) {
    console.error(`Failed to send email to ${params.to}:`, error);
    throw error;
  }
}

/**
 * Helper to fetch the owner(s) of an organization
 */
export async function getOrgOwnerEmails(orgId: string): Promise<string[]> {
  const db = getFirestore(admin.app(), PROPLEAD_DB_NAME);
  const usersSnap = await db
    .collection("users")
    .where("orgId", "==", orgId)
    .where("role", "==", "owner")
    .get();

  const emails: string[] = [];
  usersSnap.forEach((doc) => {
    const data = doc.data();
    if (data.email) emails.push(data.email);
  });
  return emails;
}

/**
 * High-level: Welcome email (sent on first signup).
 */
export async function sendWelcomeNotification(email: string, name: string): Promise<void> {
  const prefs = buildWelcomeEmailPreferenceLinks(email);
  const html = formatWelcomeEmail({ name, ...(prefs ?? {}) });
  await sendEmailToUser({
    to: email,
    subject: "¡Bienvenido a Proplead! 🚀",
    html,
  });
}

/**
 * High-level: Low balance alert sent to all org owners.
 */
export async function sendLowBalanceNotification(orgId: string, balance: number): Promise<void> {
  const owners = await getOrgOwnerEmails(orgId);
  if (owners.length === 0) {
    console.warn(`No owners found for org ${orgId}. Cannot send low balance notification.`);
    return;
  }

  const db = getFirestore(admin.app(), PROPLEAD_DB_NAME);
  const ownerDoc = await db
    .collection("users")
    .where("orgId", "==", orgId)
    .where("role", "==", "owner")
    .limit(1)
    .get();
  const name = ownerDoc.empty ? "Team" : ownerDoc.docs[0].data().name || "Team";

  const html = formatLowBalanceEmail({ name, balance });

  for (const email of owners) {
    await sendEmailToUser({
      to: email,
      subject: "Pausa programada del asistente ⏳",
      html,
    });
  }
}

/**
 * High-level: Payment failed alert sent to all org owners.
 */
export async function sendPaymentFailedNotification(orgId: string, amount: string): Promise<void> {
  const owners = await getOrgOwnerEmails(orgId);
  if (owners.length === 0) {
    console.warn(`No owners found for org ${orgId}. Cannot send payment failed notification.`);
    return;
  }

  const db = getFirestore(admin.app(), PROPLEAD_DB_NAME);
  const orgSnap = await db.collection("organizations").doc(orgId).get();
  const orgName = organizationDisplayNameFromOrgDoc({
    orgId,
    exists: orgSnap.exists,
    data: orgSnap.data(),
    fallback: "Tu Organización",
  });

  const ownerDoc = await db
    .collection("users")
    .where("orgId", "==", orgId)
    .where("role", "==", "owner")
    .limit(1)
    .get();
  const name = ownerDoc.empty ? "Team" : ownerDoc.docs[0].data().name || "Team";

  const html = formatPaymentFailedEmail({ name, orgName, lastPaymentAmount: amount });

  for (const email of owners) {
    await sendEmailToUser({
      to: email,
      subject: "Fallo en la renovación 💳",
      html,
    });
  }
}

/**
 * High-level: Invitation email for a team member joining an org.
 */
export async function sendInvitationNotification(params: {
  email: string;
  name: string;
  orgName: string;
  inviterName: string;
  token: string;
}): Promise<void> {
  const base = APP_BASE_URL.value().trim().replace(/\/+$/, "");
  const inviteLink = base ? `${base}/invite?token=${params.token}` : `/invite?token=${params.token}`;
  const html = formatInvitationEmail({
    name: params.name,
    orgName: params.orgName,
    inviterName: params.inviterName,
    inviteLink,
  });

  await sendEmailToUser({
    to: params.email,
    subject: `${params.inviterName} te ha invitado a Proplead`,
    html,
  });
}

/**
 * High-level: Password reset email with a Firebase Auth action link.
 */
export async function sendPasswordResetNotification(
  email: string,
  resetUrl: string
): Promise<void> {
  const { subject, html } = formatPasswordResetEmail({ resetUrl });
  await sendEmailToUser({ to: email, subject, html });
}

/**
 * High-level: Admin alert when a new user signs up.
 */
export async function sendNewSignupAlert(params: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<void> {
  const html = formatNewSignupAlertEmail(params);
  await sendEmailToUser({
    to: "ejperezreyes@gmail.com",
    subject: `🎉🚀 ¡Nuevo usuario en Proplead! — ${params.email}`,
    html,
  });
}

/**
 * High-level: Support inquiry forwarded to the support inbox.
 * Wired here for future use — no HTTP endpoint yet.
 */
export async function sendSupportInquiryNotification(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string | null;
  locale?: string;
  sourcePage?: string;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  const html = renderSupportInquiryEmail(params);
  // The sender's email is rendered in the email body's metadata table — Twilio's
  // Email API reply-to field shape is finicky, so we surface it in the body
  // instead and skip the header.
  await sendEmailToUser({
    to: "ejperezreyes@gmail.com",
    subject: `📩 Soporte Proplead — ${params.subject}`,
    html,
  });
}
