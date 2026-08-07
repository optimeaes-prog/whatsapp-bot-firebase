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
 * Solo marcamos leads cuando el aviso ha salido de verdad hacia la agencia.
 *
 * En ensayo no se envía nada, y con número de pruebas el mensaje va a nosotros,
 * no a ellos: en los dos casos marcar dejaría al primer aviso real sin nada que
 * contar, que parece una avería.
 */
export function shouldMarkLeads(opts: { dryRun: boolean; usingTestRecipient: boolean }): boolean {
  return !opts.dryRun && !opts.usingTestRecipient;
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
  /**
   * ANDAMIO TEMPORAL — ver INACTIVITY_ALERT_TEST_NUMBER. Desvía el aviso a este
   * número en lugar de a la agencia. Exige `onlyOrgId`.
   */
  testRecipient?: string;
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

  const testRecipient = (params.testRecipient || "").trim();
  // Cerrojo: el desvío solo vale acotado a una organización. Si alguien pone el
  // número y se olvida del orgId no seguimos, porque las dos lecturas posibles
  // son malas: o mandar a todas las agencias algo que era una prueba, o
  // secuestrar los avisos de todas hacia un móvil.
  if (testRecipient && !params.onlyOrgId) {
    console.error(
      "[inactiveLeadsAlert] INACTIVITY_ALERT_TEST_NUMBER está puesto sin INACTIVITY_ALERT_ONLY_ORG; no se ejecuta nada"
    );
    return summary;
  }
  const usingTestRecipient = Boolean(testRecipient);
  if (usingTestRecipient) {
    console.warn(
      `[inactiveLeadsAlert] ANDAMIO DE PRUEBAS ACTIVO: el aviso de ${params.onlyOrgId} se desvía a ` +
        `${testRecipient} y la agencia no recibe nada. Quitar INACTIVITY_ALERT_TEST_NUMBER al terminar.`
    );
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

        // El desvío se aplica después de resolver los números de la agencia, para
        // que el log siga enseñando a quién habría ido en un envío normal.
        const targets = usingTestRecipient ? [testRecipient] : recipients;

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
              `destinatarios=${targets.join(", ")} template=${templateSid}` +
              (usingTestRecipient ? ` (desviado; la agencia sería ${recipients.join(", ")})` : "")
          );
          console.log(`[inactiveLeadsAlert] DRY_RUN mensaje:\n${body}`);
          summary.orgsNotified += 1;
          return;
        }

        let sent = 0;
        for (const to of targets) {
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

        if (!shouldMarkLeads({ dryRun: params.dryRun, usingTestRecipient })) {
          console.log(
            `[inactiveLeadsAlert] org=${orgId} enviado a ${targets.join(", ")} sin marcar ` +
              `(${leads.length} leads siguen pendientes para el primer aviso real)`
          );
          return;
        }
        summary.leadsMarked += await markLeadsNotified(orgId, leads, params.nowMs);
      });
    } catch (e) {
      console.error(`[inactiveLeadsAlert] org=${orgId} failed`, e);
    }
  }

  return summary;
}
