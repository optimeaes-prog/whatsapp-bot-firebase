import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import { getBotConfig } from "./firestore";
import { listInactiveSalesLeads, type InactiveLead } from "./inactiveLeadsService";
import { signInactiveLeadsToken } from "./inactiveLeadsToken";
import { sendAgentNotificationMessage } from "./messagingProvider";
import { resolveQualifiedLeadNotificationRecipients } from "./qualifiedLeadNotificationTargets";
import { requestContext } from "./requestContext";

/**
 * Aviso diario de "leads sin respuesta".
 *
 * Una vez al día, por cada organización con al menos un lead frío *nuevo*, se
 * manda UN WhatsApp a los números de notificación de esa agencia con cuántos
 * son y un enlace firmado a la página. No es un mensaje por lead: sería ruido.
 */

const DB_NAME = "realestate-whatsapp-bot";
const MAX_ORGS = 500;
/** Firestore admite 500 escrituras por lote; dejamos margen. */
const MARKER_BATCH_SIZE = 400;

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

export type InactiveLeadsAlertSummary = {
  dryRun: boolean;
  orgsScanned: number;
  orgsNotified: number;
  messagesSent: number;
  leadsMarked: number;
};

/**
 * Un lead cuenta como "nuevo" si nunca lo hemos avisado, o si ha vuelto a
 * escribir después de la última vez que avisamos y se ha quedado callado otra
 * vez. Sin esto mandaríamos el mismo aviso todos los días para siempre.
 */
export function isNewlyCold(lead: InactiveLead): boolean {
  if (lead.inactivityNotifiedAtMs === null) return true;
  return lead.lastMessageAtMs > lead.inactivityNotifiedAtMs;
}

/**
 * El texto tiene que decir lo mismo que la plantilla aprobada por Meta: cuando
 * la ventana de 24h está abierta se manda tal cual como mensaje libre, y cuando
 * está cerrada se manda la plantilla con estas variables. Por eso el enlace va
 * dentro del cuerpo y no en un botón.
 */
export function buildInactiveLeadsMessage(
  leadCount: number,
  pageUrl: string
): { body: string; variables: Record<string, string> } {
  const body = [
    `Tienes ${leadCount} leads de venta sin respuesta desde hace más de 48 horas.`,
    "",
    `Consulta la lista aquí: ${pageUrl}`,
    "",
    "- Proplead",
  ].join("\n");
  return { body, variables: { "1": String(leadCount), "2": pageUrl } };
}

/** Marca los leads como avisados para no repetirlos mañana. */
async function markLeadsNotified(
  orgId: string,
  leads: InactiveLead[],
  atMs: number
): Promise<number> {
  const leadsRef = db().collection("organizations").doc(orgId).collection("leads");
  const stamp = Timestamp.fromMillis(atMs);
  let written = 0;

  for (let i = 0; i < leads.length; i += MARKER_BATCH_SIZE) {
    const chunk = leads.slice(i, i + MARKER_BATCH_SIZE);
    const batch = db().batch();
    for (const lead of chunk) {
      batch.set(leadsRef.doc(lead.id), { inactivityNotifiedAt: stamp }, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

/**
 * Recorre las organizaciones y avisa a las que tengan leads fríos nuevos.
 *
 * En ensayo (`dryRun`) se escribe en el log lo que se enviaría y **no se marca
 * ningún lead**: si se marcasen, la primera ejecución de verdad no encontraría
 * nada nuevo y no enviaría nada, que parece una avería.
 */
export async function runDailyInactiveLeadsAlert(params: {
  nowMs: number;
  linkSecret: string;
  appBaseUrl: string;
  defaultTemplateSid: string;
  envNotificationFallback: string;
  dryRun: boolean;
  /** Solo esta organización. Para probar sin tocar al resto de agencias. */
  onlyOrgId?: string;
}): Promise<InactiveLeadsAlertSummary> {
  const summary: InactiveLeadsAlertSummary = {
    dryRun: params.dryRun,
    orgsScanned: 0,
    orgsNotified: 0,
    messagesSent: 0,
    leadsMarked: 0,
  };

  if (!params.linkSecret) {
    console.error("[inactiveLeadsAlert] INACTIVE_LEADS_SECRET is empty; cannot mint links");
    return summary;
  }

  const baseUrl = params.appBaseUrl.replace(/\/+$/, "");
  const orgsSnap = await db().collection("organizations").limit(MAX_ORGS).get();

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    if (params.onlyOrgId && orgId !== params.onlyOrgId) continue;
    summary.orgsScanned += 1;

    try {
      // Cada org corre en su propio contexto: getBotConfig() y todo lo que use
      // getActiveOrgId() tiene que ver ESTA organización y no la anterior.
      await requestContext.run({ orgId }, async () => {
        const leads = await listInactiveSalesLeads(orgId, params.nowMs);
        if (leads.length === 0) return;

        const newly = leads.filter(isNewlyCold);
        if (newly.length === 0) return;

        const botConfig = await getBotConfig();
        const recipients = await resolveQualifiedLeadNotificationRecipients({
          orgId,
          botConfig,
          envNotificationFallback: params.envNotificationFallback,
          // Sin anuncio concreto: el aviso es de la agencia entera, así que los
          // destinatarios son los números de notificación de la organización.
          listing: null,
          db: db(),
        });
        if (recipients.length === 0) {
          console.warn(`[inactiveLeadsAlert] org=${orgId} has ${leads.length} cold leads but no notification numbers`);
          return;
        }

        const templateSid = (botConfig.twilioTemplates?.inactiveLeads || params.defaultTemplateSid || "").trim();
        if (!templateSid) {
          console.warn(`[inactiveLeadsAlert] org=${orgId} has no template SID configured; skipping`);
          return;
        }

        // Enlace nuevo en cada envío: caduca a las 48h, así que reutilizar uno
        // viejo dejaría al agente con un enlace muerto.
        const token = signInactiveLeadsToken(orgId, params.linkSecret);
        const pageUrl = `${baseUrl}/leads-inactivos?t=${encodeURIComponent(token)}`;
        const { body, variables } = buildInactiveLeadsMessage(leads.length, pageUrl);

        if (params.dryRun) {
          console.log(
            `[inactiveLeadsAlert] DRY_RUN org=${orgId} leads=${leads.length} nuevos=${newly.length} ` +
              `destinatarios=${recipients.join(", ")} template=${templateSid}`
          );
          console.log(`[inactiveLeadsAlert] DRY_RUN mensaje:\n${body}`);
          summary.orgsNotified += 1;
          return;
        }

        let sent = 0;
        for (const to of recipients) {
          try {
            await sendAgentNotificationMessage({
              to,
              body,
              templateSid,
              twilioTemplateVariables: variables,
              context: "inactive_leads_alert",
            });
            sent += 1;
          } catch (e) {
            console.error(`[inactiveLeadsAlert] send failed org=${orgId}`, e);
          }
        }

        summary.messagesSent += sent;
        if (sent === 0) {
          // No se enteró nadie: no marcamos, para volver a intentarlo mañana.
          console.error(`[inactiveLeadsAlert] org=${orgId} every send failed; leads left unmarked`);
          return;
        }

        summary.orgsNotified += 1;
        summary.leadsMarked += await markLeadsNotified(orgId, leads, params.nowMs);
      });
    } catch (e) {
      console.error(`[inactiveLeadsAlert] org=${orgId} failed`, e);
    }
  }

  return summary;
}
