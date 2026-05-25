import sgMail from "@sendgrid/mail";

import { formatWelcomeEmail } from "../services/emailTemplates";
import { signEmailPrefsToken } from "../services/emailPreferenceToken";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(prefix));
  if (!hit) return undefined;
  return hit.slice(prefix.length).trim();
}

async function main() {
  const to = getArg("to") || process.env.TEST_EMAIL_TO;
  const name = getArg("name") || "Eddy";
  const orgName = getArg("org") || "Proplead";

  if (!to) {
    throw new Error('Missing recipient. Provide "--to=email@domain.com" or set TEST_EMAIL_TO.');
  }

  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing SENDGRID_API_KEY in environment.");
  }

  const fromEmail = (process.env.SENDGRID_FROM_EMAIL || "noreply@proplead.io").trim();
  const fromName = (process.env.SENDGRID_FROM_NAME || "Proplead").trim();

  sgMail.setApiKey(apiKey);

  const unsubSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
  let prefs: { preferencesUrl?: string; unsubscribeUrl?: string } = {};
  if (unsubSecret) {
    const token = signEmailPrefsToken(to, unsubSecret);
    const enc = encodeURIComponent(token);
    prefs = {
      preferencesUrl: `https://proplead.io/email-preferences?t=${enc}`,
      unsubscribeUrl: `https://proplead.io/api/email-unsubscribe?token=${enc}&confirm=1`,
    };
  }

  const html = formatWelcomeEmail({ name, orgName, ...prefs });

  await sgMail.send({
    to,
    from: { email: fromEmail, name: fromName },
    subject: "¡Bienvenido a Proplead! 🚀",
    html,
  });

  // eslint-disable-next-line no-console
  console.log(`Sent test welcome email to ${to}`);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  process.exitCode = 1;
});

