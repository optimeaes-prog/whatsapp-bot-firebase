import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import { getBotConfig } from "./firestore";
import { createInactiveLeadsLink, purgeExpiredInactiveLeadsLinks } from "./inactiveLeadsLinks";
import { listInactiveSalesLeads, type InactiveLead } from "./inactiveLeadsService";
import { INACTIVE_LEADS_TOKEN_TTL_MS, signInactiveLeadsToken } from "./inactiveLeadsToken";
import { sendAgentNotificationMessage } from "./messagingProvider";
import {
  QUALIFIED_LEAD_NOTIFICATION_NUMBERS_FIELD,
  fetchAgentNotificationNumbers,
  mergeOrgAndAgentRecipients,
  normalizePhoneForDedupe,
  resolveQualifiedLeadNotificationRecipients,
  splitNotificationNumberRaw,
} from "./qualifiedLeadNotificationTargets";
import { requestContext } from "./requestContext";

/**
 * Aviso diario de "leads sin respuesta".
 *
 * Una vez al día, por cada organización con leads fríos *nuevos*:
 *
 * - a los números centrales les llega la lista entera de la agencia;
 * - a cada agente con leads suyos le llega un mensaje con los suyos y un enlace
 *   que solo enseña esos.
 *
 * Un agente cuyo número ya esté en los centrales no recibe el suyo aparte: ya
 * ha visto la lista completa y serían dos mensajes para lo mismo.
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
  /** Ninguna lead fría: o no hay, o están todas marcadas como contactadas. */
  orgsWithoutColdLeads: number;
  /** Hay leads frías, pero ya se avisó de todas y ninguna ha vuelto a enfriarse. */
  orgsWithoutNewLeads: number;
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
 * Por qué una organización no recibe aviso hoy, o `null` si sí lo recibe.
 *
 * Devuelve el motivo y no un booleano porque los dos casos se leen igual desde
 * fuera (no llega nada) y significan cosas distintas: "ya se ha hablado con
 * todos" contra "no hay novedades". Sin distinguirlos, un día sin mensajes no
 * se puede interpretar.
 *
 * `leads` ya viene sin los marcados como "Contactado": la consulta los quita.
 */
export type OrgSkipReason = "sin_leads_frias" | "sin_leads_nuevas";

export function orgSkipReason(leads: InactiveLead[]): OrgSkipReason | null {
  if (leads.length === 0) return "sin_leads_frias";
  if (!leads.some(isNewlyCold)) return "sin_leads_nuevas";
  return null;
}

/**
 * Solo marcamos leads cuando el aviso ha salido de verdad hacia la agencia.
 *
 * En ensayo no se envía nada, así que marcar dejaría al primer aviso real sin
 * nada que contar, que parece una avería.
 */
export function shouldMarkLeads(opts: { dryRun: boolean }): boolean {
  return !opts.dryRun;
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

/**
 * Roles que ven la lista entera de la agencia, no solo sus leads.
 *
 * `super_admin` queda fuera a propósito: es un rol de plataforma, no de la
 * agencia, y no debe recibir automáticamente los leads de todos los clientes.
 * Si alguien de Proplead tiene que verlos, se le pone en los números centrales.
 */
const SUPERVISOR_ROLES = ["owner", "admin"];

/**
 * Números de los responsables de la organización (owner/admin) con WhatsApp
 * configurado en la pantalla de equipo.
 *
 * La regla es por rol y no por una lista aparte: quien dirige la agencia ve
 * todo y quien lleva sus leads ve los suyos, que es la distinción que ya existe
 * en el equipo. Así no hay una segunda lista que mantener ni que recordar
 * actualizar al dar de alta a alguien.
 */
async function fetchSupervisorNumbers(orgId: string): Promise<string[]> {
  // Se filtra por organización en la consulta y por rol en memoria a propósito.
  // Combinar los dos campos pediría un índice compuesto que no existe, y un
  // equipo son unas pocas personas: no compensa arriesgarse a que el job casque
  // a las 09:00 por un índice que falta.
  const snap = await db().collection("users").where("orgId", "==", orgId).get();

  const numbers: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const role = typeof data.role === "string" ? data.role : "";
    if (!SUPERVISOR_ROLES.includes(role)) continue;
    const raw = data[QUALIFIED_LEAD_NOTIFICATION_NUMBERS_FIELD];
    if (typeof raw === "string" && raw.trim()) numbers.push(...splitNotificationNumberRaw(raw));
  }
  return numbers;
}

/** A quién se avisa y con qué leads. `agentUid` vacío = la agencia entera. */
export type AlertAudience = {
  agentUid: string;
  numbers: string[];
  leads: InactiveLead[];
};

/**
 * Reparte los leads en destinatarios: primero quien ve la agencia entera
 * (números centrales + responsables), y luego un bloque por agente con los suyos.
 *
 * Un número que ya recibe la lista completa se descarta del bloque del agente:
 * esa persona ya la tiene, y mandarle además un recorte sería el mismo aviso
 * dos veces.
 */
export function buildAudiences(params: {
  leads: InactiveLead[];
  fullListNumbers: string[];
  agentNumbers: Map<string, string[]>;
}): AlertAudience[] {
  const audiences: AlertAudience[] = [];

  if (params.fullListNumbers.length > 0) {
    audiences.push({ agentUid: "", numbers: params.fullListNumbers, leads: params.leads });
  }

  const centralFingerprints = new Set(params.fullListNumbers.map(normalizePhoneForDedupe));

  const leadsByAgent = new Map<string, InactiveLead[]>();
  for (const lead of params.leads) {
    if (!lead.assignedAgentUid) continue;
    const list = leadsByAgent.get(lead.assignedAgentUid);
    if (list) list.push(lead);
    else leadsByAgent.set(lead.assignedAgentUid, [lead]);
  }

  for (const [agentUid, agentLeads] of leadsByAgent) {
    const numbers = (params.agentNumbers.get(agentUid) || []).filter(
      (n) => !centralFingerprints.has(normalizePhoneForDedupe(n))
    );
    if (numbers.length === 0) continue;
    audiences.push({ agentUid, numbers, leads: agentLeads });
  }

  return audiences;
}

/** Marca los leads como avisados para no repetirlos mañana. */
async function markLeadsNotified(
  orgId: string,
  leadIds: string[],
  atMs: number
): Promise<number> {
  const leadsRef = db().collection("organizations").doc(orgId).collection("leads");
  const stamp = Timestamp.fromMillis(atMs);
  let written = 0;

  for (let i = 0; i < leadIds.length; i += MARKER_BATCH_SIZE) {
    const chunk = leadIds.slice(i, i + MARKER_BATCH_SIZE);
    const batch = db().batch();
    for (const leadId of chunk) {
      batch.set(leadsRef.doc(leadId), { inactivityNotifiedAt: stamp }, { merge: true });
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
    orgsWithoutColdLeads: 0,
    orgsWithoutNewLeads: 0,
  };

  if (!params.linkSecret) {
    console.error("[inactiveLeadsAlert] INACTIVE_LEADS_SECRET is empty; cannot mint links");
    return summary;
  }

  const baseUrl = params.appBaseUrl.replace(/\/+$/, "");

  // Los códigos de ayer ya no valen: se van limpiando aquí para no montar otro
  // job solo para eso. Si falla, no se envía peor, solo queda basura.
  if (!params.dryRun) {
    try {
      const purged = await purgeExpiredInactiveLeadsLinks(params.nowMs);
      if (purged > 0) console.log(`[inactiveLeadsAlert] enlaces caducados borrados: ${purged}`);
    } catch (e) {
      console.error("[inactiveLeadsAlert] purge of expired links failed", e);
    }
  }

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
        const skipReason = orgSkipReason(leads);
        if (skipReason === "sin_leads_frias") {
          summary.orgsWithoutColdLeads += 1;
          return;
        }
        if (skipReason === "sin_leads_nuevas") {
          summary.orgsWithoutNewLeads += 1;
          return;
        }

        const newly = leads.filter(isNewlyCold);

        const botConfig = await getBotConfig();
        const centralNumbers = await resolveQualifiedLeadNotificationRecipients({
          orgId,
          botConfig,
          envNotificationFallback: params.envNotificationFallback,
          // Sin anuncio concreto: el aviso es de la agencia entera, así que los
          // destinatarios son los números de notificación de la organización.
          listing: null,
          db: db(),
        });
        // Los responsables (owner/admin) ven la lista entera aunque no estén en
        // los números centrales. Así el dueño de la agencia recibe todos los
        // leads sin quedar suscrito además a los cualificados de sus agentes,
        // que es lo que pasaría si se le metiera en los centrales.
        const supervisorNumbers = await fetchSupervisorNumbers(orgId);
        const fullListNumbers = mergeOrgAndAgentRecipients(centralNumbers, supervisorNumbers);

        if (fullListNumbers.length === 0) {
          console.warn(`[inactiveLeadsAlert] org=${orgId} has ${leads.length} cold leads but no notification numbers`);
          return;
        }

        const templateSid = (botConfig.twilioTemplates?.inactiveLeads || params.defaultTemplateSid || "").trim();
        if (!templateSid) {
          console.warn(`[inactiveLeadsAlert] org=${orgId} has no template SID configured; skipping`);
          return;
        }

        // Números de cada agente que tenga leads en la lista. Se resuelven
        // ANTES de enviar nada, para que todos los mensajes salgan de la misma
        // foto de leads.
        const agentUids = [...new Set(leads.map((l) => l.assignedAgentUid).filter(Boolean))];
        const agentNumbers = new Map<string, string[]>();
        for (const agentUid of agentUids) {
          const numbers = await fetchAgentNotificationNumbers({ db: db(), orgId, assignedUid: agentUid });
          if (numbers.length > 0) agentNumbers.set(agentUid, numbers);
        }

        const audiences = buildAudiences({ leads, fullListNumbers, agentNumbers });

        if (params.dryRun) {
          console.log(
            `[inactiveLeadsAlert] DRY_RUN org=${orgId} leads=${leads.length} nuevos=${newly.length} ` +
              `avisos=${audiences.length} template=${templateSid}`
          );
          for (const audience of audiences) {
            const who = audience.agentUid ? `agente ${audience.agentUid}` : "central";
            console.log(
              `[inactiveLeadsAlert] DRY_RUN ${who}: ${audience.leads.length} leads → ${audience.numbers.join(", ")}`
            );
          }
          summary.orgsNotified += 1;
          return;
        }

        // Solo se marcan los leads que han entrado en un mensaje que salió. Si
        // falla el de un agente, sus leads siguen pendientes y mañana se le
        // vuelve a avisar, aunque el mensaje central sí haya salido.
        const notifiedLeadIds = new Set<string>();
        let sentForOrg = 0;

        for (const audience of audiences) {
          // Enlace nuevo por destinatario: caduca a las 48h, y el del agente va
          // firmado con su uid para que solo enseñe sus leads.
          const token = signInactiveLeadsToken(
            orgId,
            params.linkSecret,
            undefined,
            audience.agentUid || undefined
          );
          // El token entero en la URL ocupa cinco líneas en WhatsApp, así que
          // viaja un código corto que apunta a él.
          const code = await createInactiveLeadsLink({
            token,
            expiresAtMs: params.nowMs + INACTIVE_LEADS_TOKEN_TTL_MS,
          });
          const pageUrl = `${baseUrl}/leads-inactivos/${code}`;
          const { body, variables } = buildInactiveLeadsMessage(audience.leads.length, pageUrl);

          let sentForAudience = 0;
          for (const to of audience.numbers) {
            try {
              await sendAgentNotificationMessage({
                to,
                body,
                templateSid,
                twilioTemplateVariables: variables,
                context: "inactive_leads_alert",
              });
              sentForAudience += 1;
            } catch (e) {
              console.error(
                `[inactiveLeadsAlert] send failed org=${orgId} agente=${audience.agentUid || "central"}`,
                e
              );
            }
          }

          sentForOrg += sentForAudience;
          if (sentForAudience > 0) {
            for (const lead of audience.leads) notifiedLeadIds.add(lead.id);
          }
        }

        summary.messagesSent += sentForOrg;
        if (notifiedLeadIds.size === 0) {
          // No se enteró nadie: no marcamos, para volver a intentarlo mañana.
          console.error(`[inactiveLeadsAlert] org=${orgId} every send failed; leads left unmarked`);
          return;
        }

        summary.orgsNotified += 1;

        // Redundante hoy (el ensayo ya ha salido antes de enviar), pero deja la
        // regla dicha en un sitio con nombre: solo se marca lo que se ha enviado.
        if (!shouldMarkLeads({ dryRun: params.dryRun })) return;
        summary.leadsMarked += await markLeadsNotified(orgId, [...notifiedLeadIds], params.nowMs);
      });
    } catch (e) {
      console.error(`[inactiveLeadsAlert] org=${orgId} failed`, e);
    }
  }

  return summary;
}
