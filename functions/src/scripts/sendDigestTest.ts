import { writeFileSync } from "fs";
import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { sendEmailToUser } from "../services/emailService";
import {
  madridBounds,
  buildDigestHtml,
  buildSubject,
  type DigestTask,
  type Bucket,
} from "../services/followUpDigestService";

/**
 * Test puntual: envía (o previsualiza) el correo de seguimientos de UNA organización a un
 * destinatario, juntando TODOS sus pendientes (no separados por agente).
 *
 * Uso (desde functions/):
 *   npm run build
 *   # Previsualizar sin enviar (solo lee Firestore con ADC):
 *   node lib/scripts/sendDigestTest.js --org="utopia living" --dry-run
 *   # Enviar de verdad (necesita las credenciales de email de Twilio en el entorno):
 *   TWILIO_API_KEY=... TWILIO_API_SECRET=... \
 *     node lib/scripts/sendDigestTest.js --to=ejperezreyes@gmail.com --org="utopia living"
 */

const PROJECT_ID = "real-estate-idealista-bot";
const DB_NAME = "realestate-whatsapp-bot";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const to = getArg("to") || "ejperezreyes@gmail.com";
  const orgQuery = (getArg("org") || "utopia living").toLowerCase();
  const dryRun = hasFlag("dry-run");

  if (admin.apps.length === 0) admin.initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(admin.app(), DB_NAME);

  // Normaliza para comparar sin distinguir mayúsculas ni acentos ("utopia" ~ "Utopía").
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const orgNeedle = norm(orgQuery);

  // 1) Localizar la organización por agencyName (contiene).
  const orgsSnap = await db.collection("organizations").limit(500).get();
  const match = orgsSnap.docs.find((d) =>
    norm(String((d.data() || {}).agencyName || "")).includes(orgNeedle)
  );
  if (!match) {
    const names = orgsSnap.docs
      .map((d) => d.data()?.agencyName)
      .filter(Boolean)
      .join(" | ");
    throw new Error(`No encuentro ninguna organización cuyo agencyName contenga "${orgQuery}". Disponibles: ${names}`);
  }
  const orgId = match.id;
  const orgName = String(match.data()?.agencyName || orgId);
  console.log(`Organización: ${orgName} (${orgId})`);

  // 2) Reunir todos los pendientes (propietarios + compradores) del org.
  const now = Date.now();
  const { startToday, endToday, endIn7 } = madridBounds(now);
  const upper = Timestamp.fromMillis(endIn7);
  const tasksByBucket: Record<Bucket, DigestTask[]> = { vencidas: [], hoy: [], proximos7: [] };

  for (const kind of ["prospects", "leads"] as const) {
    const snap = await db
      .collection("organizations").doc(orgId).collection(kind)
      .where("nextActionDate", "<=", upper)
      .get();
    const isOwner = kind === "prospects";
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const nextMs = (data.nextActionDate as FirebaseFirestore.Timestamp | undefined)?.toMillis?.();
      if (!nextMs) continue;
      if (isOwner) {
        if (data.stage === "ganado" || data.stage === "descartado") continue;
      } else {
        if (data.followUpStatus === "cerrado") continue;
      }
      const bucket: Bucket = nextMs < startToday ? "vencidas" : nextMs <= endToday ? "hoy" : "proximos7";
      const name = String(
        (isOwner ? data.ownerName : data.name) || data.phone || (isOwner ? "Propietario sin nombre" : "Comprador sin nombre")
      );
      tasksByBucket[bucket].push({
        kind: isOwner ? "owner" : "buyer",
        name,
        phone: data.phone ? String(data.phone) : undefined,
        whenMs: nextMs,
        nextActionType: data.nextActionType ?? null,
        nextActionMessage: data.nextActionMessage ?? null,
        operationType: data.operationType ? String(data.operationType) : undefined,
        municipality: data.municipality ? String(data.municipality) : undefined,
        bucket,
      });
    }
  }

  const total = tasksByBucket.vencidas.length + tasksByBucket.hoy.length + tasksByBucket.proximos7.length;
  console.log(`Pendientes — vencidas=${tasksByBucket.vencidas.length} hoy=${tasksByBucket.hoy.length} proximos7=${tasksByBucket.proximos7.length} (total ${total})`);

  const appBase = (process.env.APP_BASE_URL || "https://proplead.io").replace(/\/+$/, "");
  const subject = `[TEST · ${orgName}] ${buildSubject(tasksByBucket)}`;
  const html = buildDigestHtml({ agentName: orgName, tasksByBucket, appBase });

  if (dryRun) {
    const out = "/tmp/digest-preview.html";
    writeFileSync(out, html);
    console.log(`DRY RUN — no se envió nada. Previsualización escrita en ${out}`);
    return;
  }

  await sendEmailToUser({ to, subject, html });
  console.log(`Correo de prueba enviado a ${to}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exitCode = 1;
});
