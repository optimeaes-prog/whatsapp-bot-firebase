import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import { sendEmailToUser } from "./emailService";
import { APP_BASE_URL } from "../appConfig";

const DB_NAME = "realestate-whatsapp-bot";
const GRACE_MS = 30 * 60 * 1000; // se envía hasta 30 min después de la hora prevista
const MAX_LEAD_MS = 24 * 60 * 60 * 1000; // antelación máxima soportada (1 día)

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function getAgent(uid: string): Promise<{ email: string; name?: string } | null> {
  try {
    const snap = await db().collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    if (!d.email) return null;
    return { email: String(d.email), name: d.name || d.displayName };
  } catch (e) {
    console.error("[reminders] getAgent failed", uid, e);
    return null;
  }
}

function buildHtml(p: {
  agentName?: string;
  subjectName: string;
  kind: "owner" | "buyer";
  whenMs: number;
  municipality?: string;
  phone?: string;
}): string {
  const base = (APP_BASE_URL.value() || "").trim().replace(/\/+$/, "");
  const link = `${base}/seguimiento`;
  const when = new Date(p.whenMs).toLocaleString("es-ES", {
    dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid",
  });
  const who = p.kind === "owner" ? "propietario" : "comprador";
  const rows: string[] = [
    `<tr><td style="color:#6b7280;padding:3px 14px 3px 0;">Cuándo</td><td><strong>${esc(when)}</strong></td></tr>`,
  ];
  if (p.municipality) rows.push(`<tr><td style="color:#6b7280;padding:3px 14px 3px 0;">Zona</td><td>${esc(p.municipality)}</td></tr>`);
  if (p.phone) rows.push(`<tr><td style="color:#6b7280;padding:3px 14px 3px 0;">Teléfono</td><td>${esc(p.phone)}</td></tr>`);
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;">
    <div style="background:#FFB03F;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:18px;">⏰ Recordatorio de seguimiento</h1>
    </div>
    <div style="border:1px solid #f3f4f6;border-top:none;border-radius:0 0 12px 12px;padding:20px;">
      <p style="margin:0 0 8px;">Hola${p.agentName ? ` ${esc(p.agentName)}` : ""},</p>
      <p style="margin:0 0 16px;">Tienes una próxima acción con <strong>${esc(p.subjectName)}</strong> (${who}).</p>
      <table style="font-size:14px;margin-bottom:18px;border-collapse:collapse;">${rows.join("")}</table>
      <a href="${esc(link)}" style="display:inline-block;background:#FFB03F;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Abrir Seguimiento</a>
    </div>
  </div>`;
}

/**
 * Recorre todas las organizaciones y envía un email de recordatorio al agente asignado por
 * cada captación/propietario (prospects) o lead comprador (leads) cuya próxima acción tenga
 * un recordatorio vencido y aún no enviado. Marca `reminderSentAt` para no repetir.
 * Idempotente: solo envía dentro de la ventana [acción - antelación, acción + 30 min].
 */
export async function runDueReminders(nowMs: number): Promise<{ sent: number; scanned: number }> {
  const lower = Timestamp.fromMillis(nowMs - GRACE_MS);
  const upper = Timestamp.fromMillis(nowMs + MAX_LEAD_MS);
  let sent = 0;
  let scanned = 0;

  const orgsSnap = await db().collection("organizations").limit(500).get();
  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    for (const kind of ["prospects", "leads"] as const) {
      let snap: FirebaseFirestore.QuerySnapshot;
      try {
        snap = await db()
          .collection("organizations").doc(orgId).collection(kind)
          .where("nextActionDate", ">=", lower)
          .where("nextActionDate", "<=", upper)
          .get();
      } catch (e) {
        console.error(`[reminders] query failed org=${orgId} coll=${kind}`, e);
        continue;
      }
      for (const docSnap of snap.docs) {
        scanned++;
        const data = docSnap.data();
        const minutes = data.reminderMinutesBefore;
        if (minutes === null || minutes === undefined) continue;
        if (data.reminderSentAt) continue;
        const next = data.nextActionDate as FirebaseFirestore.Timestamp | undefined;
        const nextMs = next?.toMillis?.();
        if (!nextMs) continue;
        const remindAt = nextMs - Number(minutes) * 60 * 1000;
        if (nowMs < remindAt) continue;          // aún no toca
        if (nowMs > nextMs + GRACE_MS) continue; // la acción ya pasó: no molestar
        const agentUid = (data.assignedAgentUid || data.createdByUid) as string | undefined;
        if (!agentUid) continue;
        const agent = await getAgent(agentUid);
        if (!agent) continue;
        const isOwner = kind === "prospects";
        const subjectName = String(
          isOwner ? (data.ownerName || "Propietario sin nombre") : (data.name || "Comprador sin nombre")
        );
        try {
          await sendEmailToUser({
            to: agent.email,
            subject: `⏰ Recordatorio: ${subjectName} (${new Date(nextMs).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" })})`,
            html: buildHtml({
              agentName: agent.name,
              subjectName,
              kind: isOwner ? "owner" : "buyer",
              whenMs: nextMs,
              municipality: data.municipality,
              phone: data.phone,
            }),
          });
          await docSnap.ref.update({ reminderSentAt: Timestamp.fromMillis(nowMs) });
          sent++;
        } catch (e) {
          console.error(`[reminders] send failed org=${orgId} ${kind}/${docSnap.id}`, e);
        }
      }
    }
  }
  console.log(`[reminders] done sent=${sent} scanned=${scanned}`);
  return { sent, scanned };
}
