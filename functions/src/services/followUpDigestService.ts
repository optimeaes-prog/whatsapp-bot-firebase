import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import { sendEmailToUser } from "./emailService";
import { APP_BASE_URL } from "../appConfig";

const DB_NAME = "realestate-whatsapp-bot";
const TZ = "Europe/Madrid";

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// --- Email del agente ---------------------------------------------------------

async function getAgent(uid: string): Promise<{ email: string; name?: string } | null> {
  try {
    const snap = await db().collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    if (!d.email) return null;
    return { email: String(d.email), name: d.name || d.displayName };
  } catch (e) {
    console.error("[digest] getAgent failed", uid, e);
    return null;
  }
}

// --- Límites de día en horario de Madrid -------------------------------------
// Las Cloud Functions corren en UTC, así que NO sirve setHours(0,0,0,0).
// Calculamos el offset real (CET/CEST) vía Intl para que sea correcto también
// en los cambios de hora.

/** Offset de la zona horaria (ms) para un instante: (hora-de-pared como UTC) − instante real. */
function tzOffsetMs(atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(atMs)).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  return asUTC - atMs;
}

/** Año/mes/día de pared en Madrid para un instante. */
function madridYMD(atMs: number): { y: number; m: number; d: number } {
  const wall = new Date(atMs + tzOffsetMs(atMs));
  return { y: wall.getUTCFullYear(), m: wall.getUTCMonth() + 1, d: wall.getUTCDate() };
}

/** Suma n días de calendario a un Y/M/D (gestiona el cambio de mes/año). */
function addDays(ymd: { y: number; m: number; d: number }, n: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Epoch ms de la medianoche (00:00 Madrid) de un Y/M/D. */
function madridMidnight(ymd: { y: number; m: number; d: number }): number {
  const guess = Date.UTC(ymd.y, ymd.m - 1, ymd.d, 0, 0, 0);
  let result = guess - tzOffsetMs(guess);
  const off2 = tzOffsetMs(result);
  result = guess - off2; // un refinamiento basta (el cambio DST no ocurre a medianoche)
  return result;
}

/** Inicio de hoy, fin de hoy y fin del día (hoy + 7), todo en horario de Madrid. */
export function madridBounds(nowMs: number): { startToday: number; endToday: number; endIn7: number } {
  const today = madridYMD(nowMs);
  const startToday = madridMidnight(today);
  const endToday = madridMidnight(addDays(today, 1)) - 1;
  const endIn7 = madridMidnight(addDays(today, 8)) - 1; // incluye los próximos 7 días completos
  return { startToday, endToday, endIn7 };
}

// --- Tareas -------------------------------------------------------------------

export type Bucket = "vencidas" | "hoy" | "proximos7";

export interface DigestTask {
  kind: "owner" | "buyer";
  name: string;
  phone?: string;
  whenMs: number;
  nextActionType?: string | null;
  nextActionMessage?: string | null;
  operationType?: string;
  municipality?: string;
  bucket: Bucket;
}

const ACTION_LABELS: Record<string, string> = {
  call: "Llamar",
  message: "WhatsApp",
  email: "Email",
  visit: "Visita",
};

/** Enlace wa.me a partir de un teléfono en cualquier formato, con el mensaje precargado. */
function waLink(phone?: string, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return text && text.trim() ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: TZ,
  });
}

// --- Render del email ---------------------------------------------------------

function renderTaskCard(t: DigestTask): string {
  const typeLabel = t.nextActionType ? (ACTION_LABELS[t.nextActionType] || t.nextActionType) : null;
  const meta = [t.operationType, t.municipality].filter(Boolean).map(esc).join(" · ");
  const isMessage = t.nextActionType === "message";
  const isEmail = t.nextActionType === "email";
  const wa = isMessage ? waLink(t.phone, t.nextActionMessage || undefined) : null;

  const chips: string[] = [];
  if (typeLabel) {
    chips.push(
      `<span style="display:inline-block;background:#FFF3E0;color:#B45309;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;">${esc(typeLabel)}</span>`
    );
  }

  const lines: string[] = [];
  lines.push(
    `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
       <strong style="font-size:15px;color:#111827;">${esc(t.name)}</strong>
       <span style="font-size:12px;color:#6b7280;white-space:nowrap;">${esc(fmtWhen(t.whenMs))}</span>
     </div>`
  );
  if (chips.length || meta) {
    lines.push(
      `<div style="margin-top:4px;font-size:12px;color:#6b7280;">${chips.join(" ")}${chips.length && meta ? " " : ""}${meta}</div>`
    );
  }
  if (t.phone) {
    lines.push(`<div style="margin-top:4px;font-size:13px;color:#374151;">📞 ${esc(t.phone)}</div>`);
  }

  // El mensaje configurado (WhatsApp o email) se muestra para revisarlo de un vistazo.
  if ((isMessage || isEmail) && t.nextActionMessage) {
    lines.push(
      `<div style="margin-top:8px;padding:8px 10px;background:#f9fafb;border-left:3px solid #FFB03F;border-radius:4px;font-size:13px;color:#374151;white-space:pre-wrap;">${esc(t.nextActionMessage)}</div>`
    );
  }

  if (wa) {
    lines.push(
      `<div style="margin-top:8px;">
         <a href="${esc(wa)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600;font-size:13px;">Abrir WhatsApp</a>
       </div>`
    );
  }

  return `<div style="border:1px solid #f0f0f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#fff;">${lines.join("")}</div>`;
}

function renderSection(title: string, tasks: DigestTask[]): string {
  if (tasks.length === 0) return "";
  const cards = [...tasks].sort((a, b) => a.whenMs - b.whenMs).map(renderTaskCard).join("");
  return `
    <h2 style="font-size:15px;color:#111827;margin:18px 0 10px;border-bottom:1px solid #f0f0f0;padding-bottom:6px;">
      ${title} <span style="color:#9ca3af;font-weight:500;">(${tasks.length})</span>
    </h2>
    ${cards}`;
}

export function buildDigestHtml(args: {
  agentName?: string;
  tasksByBucket: Record<Bucket, DigestTask[]>;
  appBase: string;
}): string {
  const { agentName, tasksByBucket, appBase } = args;
  const link = `${appBase}/seguimiento`;
  const blocks = [
    renderSection("⏰ Vencidas", tasksByBucket.vencidas),
    renderSection("📅 Hoy", tasksByBucket.hoy),
    renderSection("🗓️ Próximos 7 días", tasksByBucket.proximos7),
  ].join("");

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
    <div style="background:#FFB03F;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:18px;">📋 Tus seguimientos de hoy</h1>
    </div>
    <div style="border:1px solid #f3f4f6;border-top:none;border-radius:0 0 12px 12px;padding:20px;">
      <p style="margin:0 0 6px;">Hola${agentName ? ` ${esc(agentName)}` : ""},</p>
      <p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Estas son tus próximas acciones pendientes. Las de WhatsApp llevan el mensaje y un botón para enviarlo en un clic.</p>
      ${blocks}
      <div style="margin-top:20px;">
        <a href="${esc(link)}" style="display:inline-block;background:#FFB03F;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Abrir Seguimiento</a>
      </div>
    </div>
  </div>`;
}

export function buildSubject(tasksByBucket: Record<Bucket, DigestTask[]>): string {
  const parts: string[] = [];
  if (tasksByBucket.vencidas.length) parts.push(`${tasksByBucket.vencidas.length} vencidas`);
  if (tasksByBucket.hoy.length) parts.push(`${tasksByBucket.hoy.length} hoy`);
  if (tasksByBucket.proximos7.length) parts.push(`${tasksByBucket.proximos7.length} próximos`);
  return `📋 Tus seguimientos${parts.length ? ` — ${parts.join(" · ")}` : ""}`;
}

// --- Job principal ------------------------------------------------------------

/**
 * Una vez al día: recorre todas las organizaciones, reúne las próximas acciones (propietarios
 * y compradores) por agente asignado y le envía UN email con sus tareas agrupadas en Vencidas,
 * Hoy y Próximos 7 días. Para las de WhatsApp incluye el mensaje configurado y un botón wa.me
 * con el texto precargado. No envía nada a agentes sin tareas.
 */
export async function runDailyFollowUpDigest(
  nowMs: number
): Promise<{ agentsEmailed: number; tasksIncluded: number }> {
  const { startToday, endToday, endIn7 } = madridBounds(nowMs);
  const upper = Timestamp.fromMillis(endIn7);

  // uid del agente -> sus tareas
  const byAgent = new Map<string, DigestTask[]>();
  let tasksIncluded = 0;

  const orgsSnap = await db().collection("organizations").limit(500).get();
  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    for (const kind of ["prospects", "leads"] as const) {
      let snap: FirebaseFirestore.QuerySnapshot;
      try {
        snap = await db()
          .collection("organizations").doc(orgId).collection(kind)
          .where("nextActionDate", "<=", upper)
          .get();
      } catch (e) {
        console.error(`[digest] query failed org=${orgId} coll=${kind}`, e);
        continue;
      }
      const isOwner = kind === "prospects";
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const next = data.nextActionDate as FirebaseFirestore.Timestamp | undefined;
        const nextMs = next?.toMillis?.();
        if (!nextMs) continue;

        // Saltar registros cerrados/fuera del pipeline activo.
        if (isOwner) {
          if (data.stage === "ganado" || data.stage === "descartado") continue;
        } else {
          if (data.followUpStatus === "cerrado") continue;
        }

        const agentUid = (data.assignedAgentUid || data.createdByUid) as string | undefined;
        if (!agentUid) continue;

        const bucket: Bucket =
          nextMs < startToday ? "vencidas" : nextMs <= endToday ? "hoy" : "proximos7";

        const name = String(
          (isOwner ? data.ownerName : data.name) || data.phone || (isOwner ? "Propietario sin nombre" : "Comprador sin nombre")
        );

        const task: DigestTask = {
          kind: isOwner ? "owner" : "buyer",
          name,
          phone: data.phone ? String(data.phone) : undefined,
          whenMs: nextMs,
          nextActionType: data.nextActionType ?? null,
          nextActionMessage: data.nextActionMessage ?? null,
          operationType: data.operationType ? String(data.operationType) : undefined,
          municipality: data.municipality ? String(data.municipality) : undefined,
          bucket,
        };

        const list = byAgent.get(agentUid);
        if (list) list.push(task);
        else byAgent.set(agentUid, [task]);
        tasksIncluded++;
      }
    }
  }

  const appBase = (APP_BASE_URL.value() || "").trim().replace(/\/+$/, "");
  let agentsEmailed = 0;

  for (const [agentUid, tasks] of byAgent) {
    const agent = await getAgent(agentUid);
    if (!agent) continue;

    const tasksByBucket: Record<Bucket, DigestTask[]> = { vencidas: [], hoy: [], proximos7: [] };
    for (const t of tasks) tasksByBucket[t.bucket].push(t);

    try {
      await sendEmailToUser({
        to: agent.email,
        subject: buildSubject(tasksByBucket),
        html: buildDigestHtml({ agentName: agent.name, tasksByBucket, appBase }),
      });
      agentsEmailed++;
    } catch (e) {
      console.error(`[digest] send failed agent=${agentUid}`, e);
    }
  }

  console.log(`[digest] done agents=${agentsEmailed} tasks=${tasksIncluded}`);
  return { agentsEmailed, tasksIncluded };
}
