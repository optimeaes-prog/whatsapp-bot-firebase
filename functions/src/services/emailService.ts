import sgMail from "@sendgrid/mail";
import { getFirestore } from "firebase-admin/firestore";
import { organizationDisplayNameFromOrgDoc } from "../utils/organizationDisplayName";
import * as admin from "firebase-admin";
import { formatWelcomeEmail, formatLowBalanceEmail, formatPaymentFailedEmail, formatInvitationEmail } from "./emailTemplates";

import { EMAIL_UNSUBSCRIBE_SECRET } from "../emailUnsubscribeParams";
import { SENDGRID_API_KEY } from "../secrets";
import { signEmailPrefsToken } from "./emailPreferenceToken";

function buildWelcomeEmailPreferenceLinks(toEmail: string): { preferencesUrl: string; unsubscribeUrl: string } | undefined {
  try {
    const secret = EMAIL_UNSUBSCRIBE_SECRET.value().trim();
    if (!secret) return undefined;
    const token = signEmailPrefsToken(toEmail, secret);
    const enc = encodeURIComponent(token);
    return {
      preferencesUrl: `https://proplead.io/email-preferences?t=${enc}`,
      unsubscribeUrl: `https://proplead.io/api/email-unsubscribe?token=${enc}&confirm=1`,
    };
  } catch {
    return undefined;
  }
}

/**
 * Unified Email Service for Proplead
 */
export async function sendEmailToUser(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = SENDGRID_API_KEY.value();
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY secret is not set. Skipping email sending.");
    return;
  }

  sgMail.setApiKey(apiKey.trim());

  try {
    await sgMail.send({
      to: params.to,
      from: { email: "noreply@proplead.io", name: "Proplead" },
      subject: params.subject,
      html: params.html,
    });
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
  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const usersSnap = await db.collection("users")
    .where("orgId", "==", orgId)
    .where("role", "==", "owner")
    .get();

  const emails: string[] = [];
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.email) emails.push(data.email);
  });
  return emails;
}

/**
 * High-level function to send Welcome Email
 */
export async function sendWelcomeNotification(email: string, name: string, orgName: string) {
  const prefs = buildWelcomeEmailPreferenceLinks(email);
  const html = formatWelcomeEmail({ name, orgName, ...(prefs ?? {}) });
  await sendEmailToUser({
    to: email,
    subject: "¡Bienvenido a Proplead! 🚀",
    html
  });
}

/**
 * High-level function to send Low Balance Alert
 */
export async function sendLowBalanceNotification(orgId: string, balance: number) {
  const owners = await getOrgOwnerEmails(orgId);
  if (owners.length === 0) {
    console.warn(`No owners found for org ${orgId}. Cannot send low balance notification.`);
    return;
  }

  // Fetch one owner name for personalization (optional, using first search result)
  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const ownerDoc = await db.collection("users").where("orgId", "==", orgId).where("role", "==", "owner").limit(1).get();
  const name = ownerDoc.empty ? "Team" : ownerDoc.docs[0].data().name || "Team";

  const html = formatLowBalanceEmail({ name, balance });
  
  // Send to all owners
  for (const email of owners) {
    await sendEmailToUser({
      to: email,
      subject: "Pausa programada del Agente Virtual ⏳",
      html
    });
  }
}

/**
 * High-level function to send Payment Failed Alert
 */
export async function sendPaymentFailedNotification(orgId: string, amount: string) {
  const owners = await getOrgOwnerEmails(orgId);
  if (owners.length === 0) {
    console.warn(`No owners found for org ${orgId}. Cannot send payment failed notification.`);
    return;
  }

  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const orgSnap = await db.collection("organizations").doc(orgId).get();
  const orgName = organizationDisplayNameFromOrgDoc({
    orgId,
    exists: orgSnap.exists,
    data: orgSnap.data(),
    fallback: "Tu Organización",
  });
  
  const ownerDoc = await db.collection("users").where("orgId", "==", orgId).where("role", "==", "owner").limit(1).get();
  const name = ownerDoc.empty ? "Team" : ownerDoc.docs[0].data().name || "Team";

  const html = formatPaymentFailedEmail({ name, orgName, lastPaymentAmount: amount });

  for (const email of owners) {
    await sendEmailToUser({
      to: email,
      subject: "Fallo en la renovación 💳",
      html
    });
  }
}

/**
 * High-level function to send Invitation Email
 */
export async function sendInvitationNotification(params: {
  email: string;
  name: string;
  orgName: string;
  inviterName: string;
  token: string;
}) {
  const inviteLink = `https://proplead.io/signup?token=${params.token}`;
  const html = formatInvitationEmail({
    name: params.name,
    orgName: params.orgName,
    inviterName: params.inviterName,
    inviteLink
  });

  await sendEmailToUser({
    to: params.email,
    subject: `${params.inviterName} te ha invitado a Proplead`,
    html
  });
}
