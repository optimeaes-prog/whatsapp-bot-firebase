import { sendSms } from "./twilioClient";

const DEFAULT_BASE = "proplead.io";

/**
 * A6c — Cold-lead SMS opt-in.
 *
 * Sends an alphanumeric SMS (sender "Marcos") to a lead captured from Idealista
 * (or any source where we lack explicit WhatsApp opt-in). The link resolves to a
 * pre-filled wa.me deep link so the consumer's first interaction is WhatsApp-
 * initiated → implicit opt-in via the 24h session window.
 *
 * Body: "Hola, {name20}. ¿Te has interesado este anuncio? idealista.com/inmueble/{listingCode}
 *        Contáctanos por WhatsApp: {base}/w/{listingCode}?l={leadId}"
 */
export async function sendIdealistaOptInSms(params: {
  phoneE164: string;
  name: string;
  listingCode: string;
  leadId?: string;
  baseDomain?: string;
}): Promise<void> {
  const name20 = (params.name || "").slice(0, 20).trim() || "";
  const greeting = name20 ? `Hola, ${name20}.` : "Hola.";
  const base = params.baseDomain || DEFAULT_BASE;
  const shortLink =
    `${base}/w/${encodeURIComponent(params.listingCode)}` +
    (params.leadId ? `?l=${encodeURIComponent(params.leadId)}` : "");
  const body =
    `${greeting} ¿Te has interesado este anuncio? idealista.com/inmueble/${params.listingCode}\n` +
    `Contáctanos por WhatsApp: ${shortLink}`;
  await sendSms({ to: params.phoneE164, body });
}
