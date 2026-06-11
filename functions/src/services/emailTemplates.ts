/**
 * Proplead transactional email templates — Bold/Cream direction.
 * Gmail-safe: table layout, inline styles, system font stack, full-hex colors.
 * Spanish-only. All templates render through buildCardEmail() for consistency.
 */

import { APP_BASE_URL, EMAIL_LOGO_URL } from "../appConfig";

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const C = {
  primary: "#FFB03F",
  cream: "#fff7e7",
  text: "#402e32", // Proplead "title brown" — used for headlines, dark badges, bullets
  muted: "#475569",
  border: "#E2E8F0",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  amber: "#D97706",
  slate400: "#94A3B8",
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appUrl(path: string): string {
  const base = APP_BASE_URL.value().trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

function logoRow(): string {
  const url = EMAIL_LOGO_URL.value().trim();
  if (!url) return "";
  return `<tr><td class="px-pad" style="padding:8px 24px 28px 24px;"><img src="${url}" alt="Proplead" height="30" style="height:30px;width:auto;display:block;border:0;outline:none;text-decoration:none;" /></td></tr>`;
}

function buildBullet(text: string): string {
  return `<tr><td style="padding:8px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle" style="padding-right:12px;">
        <table role="presentation" width="22" height="22" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background:${C.text};border-radius:4px;">
          <tr><td align="center" valign="middle" style="width:22px;height:22px;font-family:${FONT};font-size:13px;font-weight:800;color:${C.cream};line-height:22px;mso-line-height-rule:exactly;">&#10003;</td></tr>
        </table>
      </td>
      <td valign="middle" style="font-family:${FONT};font-size:15px;line-height:22px;color:${C.text};">${esc(text)}</td>
    </tr></table>
  </td></tr>`;
}

function ctaButton(href: string, label: string, accent: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${accent}" style="border-radius:6px;background:${accent};">
    <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(label)}</a>
  </td></tr></table>`;
}

function legalFooter(links?: { preferencesUrl?: string; unsubscribeUrl?: string }): string {
  const linksHtml =
    links?.preferencesUrl || links?.unsubscribeUrl
      ? `<div style="margin-top:8px;font-size:12px;color:${C.muted};">
          ${links?.preferencesUrl ? `<a href="${esc(links.preferencesUrl)}" style="color:${C.muted};text-decoration:underline;">Preferencias de email</a>` : ""}
          ${links?.preferencesUrl && links?.unsubscribeUrl ? " · " : ""}
          ${links?.unsubscribeUrl ? `<a href="${esc(links.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Darse de baja</a>` : ""}
        </div>`
      : "";
  return `<tr><td><div style="text-align:center;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};padding:24px 16px;">
    <div>© Proplead. Todos los derechos reservados.</div>
    ${linksHtml}
  </div></td></tr>`;
}

function buildCardEmail(data: {
  subject: string;
  preheaderText: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  accent: string;
  headline: string;
  intro: string;
  bullets?: string[];
  extraHtml?: string;
  ctaHref: string;
  ctaLabel: string;
  postCta?: string;
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}): string {
  const bulletRows = (data.bullets ?? []).map((b) => buildBullet(b)).join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(data.subject)}</title>
<style>
  @media (max-width:600px) {
    .container { width:100% !important; }
    .px-pad { padding-left:20px !important; padding-right:20px !important; }
    .px-card { padding-left:24px !important; padding-right:24px !important; }
    .h1 { font-size:26px !important; line-height:32px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.white};font-family:${FONT};color:${C.text};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.white};opacity:0;">${esc(data.preheaderText)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.white};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
      ${logoRow()}
      <tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.cream};border-radius:24px;">
          <tr><td class="px-card" style="padding:40px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${data.badgeBg};border-radius:5px;padding:6px 12px;font-family:${FONT};font-size:11px;font-weight:800;color:${data.badgeColor};letter-spacing:0.12em;text-transform:uppercase;">${esc(data.badge)}</td></tr></table>
            <h1 class="h1" style="margin:20px 0 0 0;font-family:${FONT};font-size:34px;line-height:38px;font-weight:800;color:${C.text};letter-spacing:-0.02em;">${esc(data.headline)}</h1>
            <p style="margin:18px 0 0 0;font-family:${FONT};font-size:16px;line-height:25px;color:${C.text};opacity:0.78;">${esc(data.intro)}</p>
          </td></tr>
          ${bulletRows ? `<tr><td class="px-card" style="padding:18px 40px 0 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${bulletRows}</table></td></tr>` : ""}
          ${data.extraHtml ? `<tr><td class="px-card" style="padding:22px 40px 0 40px;">${data.extraHtml}</td></tr>` : ""}
          <tr><td class="px-card" style="padding:30px 40px 40px 40px;">${ctaButton(data.ctaHref, data.ctaLabel, data.accent)}</td></tr>
        </table>
      </td></tr>
      ${data.postCta ? `<tr><td class="px-pad" style="padding:20px 24px 0 24px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${esc(data.postCta)}</td></tr>` : ""}
      ${legalFooter({ preferencesUrl: data.preferencesUrl, unsubscribeUrl: data.unsubscribeUrl })}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function formatWelcomeEmail(data: {
  name: string;
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}): string {
  const { name, preferencesUrl, unsubscribeUrl } = data;
  const ctaUrl = appUrl("/onboarding");

  return buildCardEmail({
    subject: "Bienvenido a Proplead",
    preheaderText: "Tres pasos para activar tu asistente y dejar de perder leads.",
    badge: "Cuenta activada",
    badgeBg: C.text,
    badgeColor: C.cream,
    accent: C.primary,
    headline: `Bienvenido, ${esc(name)}`,
    intro:
      "Tu cuenta está lista. La mayoría de cierres se pierden por tardar en responder. Proplead está para evitarlo — así puedes dejarlo todo listo en unos minutos:",
    bullets: [
      "Agenda tu onboarding call y dejamos tu asistente preparado contigo",
      "Conecta tu WhatsApp y tus anuncios de Idealista, Fotocasa o Pisos.com",
      "Responde en minutos, cualifica en segundo plano, cierra antes",
    ],
    ctaHref: ctaUrl,
    ctaLabel: "Completar onboarding",
    postCta: "¿Necesitas ayuda? Responde a este correo — lo lee una persona.",
    preferencesUrl,
    unsubscribeUrl,
  });
}

export function formatLowBalanceEmail(data: { name: string; balance: number }): string {
  const { name, balance } = data;
  const ctaUrl = appUrl("/suscripcion");
  const percentage = Math.max(8, Math.min(100, (balance / 100) * 100));

  const progressBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.white};border-radius:14px;">
      <tr><td style="padding:18px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.text};">Conversaciones restantes</td>
            <td align="right" style="font-family:${FONT};font-size:13px;font-weight:800;color:${C.danger};">${balance} / 100</td>
          </tr>
        </table>
        <div style="margin-top:10px;width:100%;height:8px;background:#FECACA;border-radius:4px;overflow:hidden;font-size:0;line-height:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${percentage}%" style="height:8px;background:${C.danger};border-radius:4px;"><tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
        </div>
        <p style="margin:12px 0 0 0;font-family:${FONT};font-size:11px;line-height:16px;color:${C.muted};">Si el saldo llega a 0, dejaremos de enviar mensajes automáticos por WhatsApp.</p>
      </td></tr>
    </table>`;

  return buildCardEmail({
    subject: "Pausa programada del asistente",
    preheaderText: `Quedan ${balance}/100 conversaciones.`,
    badge: "Saldo bajo",
    badgeBg: C.danger,
    badgeColor: C.white,
    accent: C.amber,
    headline: `Atención, ${esc(name)}`,
    intro: `Te quedan ${balance} de 100 conversaciones este ciclo. Al llegar a cero, tu asistente pausará las respuestas automáticas hasta que recargues.`,
    extraHtml: progressBlock,
    ctaHref: ctaUrl,
    ctaLabel: "Recargar saldo",
    postCta: "Si ya has recargado, puedes ignorar este aviso.",
  });
}

export function formatPaymentFailedEmail(data: {
  name: string;
  orgName: string;
  lastPaymentAmount: string;
}): string {
  const { name, orgName, lastPaymentAmount } = data;
  const ctaUrl = appUrl("/suscripcion");

  const amountBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.dangerBg};border-radius:14px;">
      <tr><td align="center" style="padding:20px;">
        <p style="margin:0;font-family:${FONT};font-size:11px;font-weight:800;color:${C.danger};letter-spacing:0.12em;text-transform:uppercase;">Monto pendiente</p>
        <p style="margin:6px 0 0 0;font-family:${FONT};font-size:30px;font-weight:800;color:#991B1B;">${esc(lastPaymentAmount)}</p>
      </td></tr>
    </table>`;

  return buildCardEmail({
    subject: "Fallo en la renovación de tu suscripción",
    preheaderText: `Cargo pendiente de ${lastPaymentAmount} en ${orgName}.`,
    badge: "Pago rechazado",
    badgeBg: C.danger,
    badgeColor: C.white,
    accent: C.danger,
    headline: `${esc(name)}, tu último pago no se completó`,
    intro: `Intentamos cobrar ${esc(lastPaymentAmount)} a la tarjeta de ${esc(orgName)} y el banco lo rechazó. Para no interrumpir el servicio, actualiza tu método de pago ahora.`,
    extraHtml: amountBlock,
    ctaHref: ctaUrl,
    ctaLabel: "Actualizar método de pago",
    postCta: "Si has cambiado de tarjeta solo te llevará un minuto.",
  });
}

export function formatInvitationEmail(data: {
  name: string;
  orgName: string;
  inviterName: string;
  inviteLink: string;
}): string {
  const { orgName, inviterName, inviteLink } = data;

  return buildCardEmail({
    subject: `${inviterName} te ha invitado a Proplead`,
    preheaderText: `Únete a ${orgName} en Proplead.`,
    badge: "Invitación de equipo",
    badgeBg: C.text,
    badgeColor: C.cream,
    accent: C.primary,
    headline: `${esc(inviterName)} te ha invitado a ${esc(orgName)}`,
    intro: `Te han invitado a colaborar en ${esc(orgName)} dentro de Proplead. La invitación expira en 7 días.`,
    ctaHref: inviteLink,
    ctaLabel: "Aceptar invitación",
    postCta: "Si no esperabas esta invitación puedes ignorarla.",
  });
}

export function formatPasswordResetEmail(data: { resetUrl: string }): {
  subject: string;
  html: string;
} {
  const { resetUrl } = data;

  return {
    subject: "Restablece tu contraseña de Proplead",
    html: buildCardEmail({
      subject: "Restablece tu contraseña de Proplead",
      preheaderText: "Pulsa el botón para establecer una nueva contraseña en Proplead.",
      badge: "Recuperar contraseña",
      badgeBg: C.text,
      badgeColor: C.cream,
      accent: C.primary,
      headline: "Restablece tu contraseña",
      intro:
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta en Proplead. Pulsa el botón — el enlace es válido durante 1 hora.",
      ctaHref: resetUrl,
      ctaLabel: "Restablecer contraseña",
      postCta: "Si no solicitaste un restablecimiento, puedes ignorar este correo.",
    }),
  };
}

export function renderSupportInquiryEmail(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string | null;
  locale?: string;
  sourcePage?: string;
  userAgent?: string;
  ip?: string;
}): string {
  const messageHtml = esc(data.message).replace(/\n/g, "<br>");
  const meta: Array<[string, string]> = [
    ["Nombre", data.name],
    ["Email", data.email],
    ["Asunto", data.subject],
    ["User ID", data.userId || "(anónimo)"],
    ["Idioma", data.locale || "-"],
    ["Página de origen", data.sourcePage || "-"],
    ["User-Agent", data.userAgent || "-"],
    ["IP (hash)", data.ip || "-"],
  ];
  const metaRows = meta
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:${C.muted};font-size:12px;white-space:nowrap;">${esc(k)}</td><td style="padding:4px 0;color:${C.text};font-size:13px;">${esc(v)}</td></tr>`
    )
    .join("");

  const logoUrl = EMAIL_LOGO_URL.value().trim();
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Proplead" height="28" style="height:28px;width:auto;display:block;border:0;margin-bottom:16px;" />`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:${FONT};background-color:${C.bg};padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid ${C.border};">
    ${logoHtml}
    <h1 style="margin:0 0 8px 0;font-size:20px;color:${C.text};">Nueva consulta de soporte</h1>
    <p style="margin:0 0 16px 0;color:${C.muted};font-size:14px;">Responde directamente a este correo para contestar al remitente.</p>
    <table role="presentation" style="border-collapse:collapse;margin:0 0 16px 0;">${metaRows}</table>
    <div style="background:${C.bg};border:1px solid ${C.border};border-radius:8px;padding:16px;color:${C.text};font-size:14px;line-height:1.6;white-space:pre-wrap;">${messageHtml}</div>
  </div>
</body>
</html>`;
}

export function formatNewSignupAlertEmail(data: {
  email: string;
  displayName: string;
  userId: string;
}): string {
  const { email, displayName, userId } = data;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const firestoreUrl = `https://console.firebase.google.com/project/real-estate-idealista-bot/firestore/databases/realestate-whatsapp-bot/data/users/${userId}`;

  const rows: Array<[string, string]> = [
    ["📛 Nombre", displayName || "(sin nombre)"],
    ["📧 Email", email],
    ["🆔 UID", userId],
    ["🕐 Hora", now],
  ];
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:${C.muted};font-size:13px;white-space:nowrap;font-weight:600;">${k}</td><td style="padding:6px 0;color:${C.text};font-size:14px;">${esc(v)}</td></tr>`
    )
    .join("");

  const logoUrl = EMAIL_LOGO_URL.value().trim();
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Proplead" height="28" style="height:28px;width:auto;display:block;border:0;margin-bottom:20px;" />`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:${FONT};background-color:${C.bg};padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:2px solid ${C.primary};">
    ${logoHtml}
    <div style="font-size:48px;line-height:1;margin-bottom:12px;">🎉🚀🥳</div>
    <h1 style="margin:0 0 6px 0;font-size:26px;font-weight:800;color:${C.text};">¡Nuevo usuario! 🎊🎊🎊</h1>
    <p style="margin:0 0 24px 0;color:${C.muted};font-size:15px;line-height:1.6;">Alguien acaba de registrarse en Proplead. ¡Esto es increíble! 🙌✨💥</p>
    <table role="presentation" style="border-collapse:collapse;width:100%;background:${C.cream};border-radius:12px;padding:0;margin:0 0 24px 0;">
      <tr><td style="padding:20px 24px;">
        <table role="presentation" style="border-collapse:collapse;width:100%;">${rowsHtml}</table>
      </td></tr>
    </table>
    <a href="${firestoreUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background:${C.primary};color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;">Ver en Firestore 🔍</a>
    <p style="margin:24px 0 0 0;font-size:22px;line-height:1.4;">💪🏆🌟💫🔥🎯🏅👏🎈</p>
  </div>
</body>
</html>`;
}
