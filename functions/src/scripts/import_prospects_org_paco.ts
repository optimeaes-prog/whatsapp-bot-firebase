import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import * as fs from "fs";

// One-off import of Paco's "SEGUIMIENTO REAL ESTATE" spreadsheet into the
// prospects (captación) collection.
//
// Run:
//   Dry run (no writes):  npx ts-node functions/src/scripts/import_prospects_org_paco.ts --dry-run
//   Real import:          npx ts-node functions/src/scripts/import_prospects_org_paco.ts
//   (real import needs GOOGLE_APPLICATION_CREDENTIALS or ADC)
//
// Input JSON is produced by the parser (default /tmp/prospects_import.json),
// overridable via IMPORT_JSON env var.

const DATABASE_ID = "realestate-whatsapp-bot";
const ORG_ID = "org_paco_granados";
const CREATOR_UID = "2tAIQNtxcbP7go4balix4G1WvFd2";
const CREATOR_NAME = "Paco Granados";
const IMPORT_SOURCE = "xlsx_seguimiento_2026";
const JSON_PATH = process.env.IMPORT_JSON || "/tmp/prospects_import.json";

const DRY_RUN = process.argv.includes("--dry-run");

type RawRec = {
  campaign: string;
  operationType: string;
  stage: string;
  ownerName: string | null;
  phone: string | null;
  municipality: string | null;
  zone: string | null;
  address: string | null;
  price: string | null;
  features: string | null;
  learnings: string | null;
  propertyType: string | null;
  stillListed: boolean | null;
  rawStatus: string | null;
  called: boolean | null;
  startDate: string | null;
  nextActionDate: string | null;
  lastContactAt: string | null;
};

function norm(s: string | null | undefined): string {
  return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  PISO: "Piso", CASA: "Casa", ATICO: "Ático", LOCAL: "Local",
  GARAJE: "Garaje", TERRENO: "Terreno", NAVE: "Nave", CHALET: "Casa",
  ADOSADO: "Casa", DUPLEX: "Piso", ESTUDIO: "Piso", APARTAMENTO: "Piso",
};
function mapPropertyType(v: string | null): string | undefined {
  const n = norm(v);
  if (!n) return undefined;
  for (const key in PROPERTY_TYPE_MAP) if (n.includes(key)) return PROPERTY_TYPE_MAP[key];
  return undefined;
}

// Map the inferred pipeline stage to a reasonable activity outcome for the
// single history entry we seed from the spreadsheet's free-text status.
const STAGE_TO_OUTCOME: Record<string, string> = {
  ilocalizable: "no_answer",
  seguimiento: "callback",
  citado: "appointment_set",
  negociacion: "docs_pending",
  ganado: "won",
  descartado: "not_interested",
  por_llamar: "other",
};

function tsFromDate(s: string | null): Timestamp | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

function load(): RawRec[] {
  const all: RawRec[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  // Exclude the duplicate "Copia de ..." sheet.
  const filtered = all.filter((r) => !norm(r.campaign).includes("COPIA DE"));
  // De-dupe by name + phone + municipio.
  const seen = new Set<string>();
  const out: RawRec[] = [];
  for (const r of filtered) {
    const key = `${norm(r.ownerName)}|${r.phone || ""}|${norm(r.municipality)}`;
    if (seen.has(key) && (r.ownerName || r.phone)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function buildDoc(r: RawRec, nowTs: Timestamp): Record<string, unknown> {
  const createdAt = tsFromDate(r.startDate) || nowTs;
  const activities: Record<string, unknown>[] = [];
  let lastContactAt = tsFromDate(r.lastContactAt);
  if (r.rawStatus && norm(r.rawStatus)) {
    const at = lastContactAt || createdAt;
    activities.push({
      id: randomUUID(),
      at,
      channel: r.called ? "call" : "note",
      outcome: STAGE_TO_OUTCOME[r.stage] || "other",
      note: r.rawStatus,
      createdByUid: CREATOR_UID,
      createdByName: `${CREATOR_NAME} (import)`,
    });
    if (!lastContactAt) lastContactAt = at;
  }
  const doc: Record<string, unknown> = {
    orgId: ORG_ID,
    stage: r.stage,
    operationType: r.operationType,
    campaign: r.campaign,
    activities,
    createdByUid: CREATOR_UID,
    assignedAgentUid: "",
    importSource: IMPORT_SOURCE,
    createdAt,
    updatedAt: nowTs,
  };
  const pt = mapPropertyType(r.propertyType);
  if (pt) doc.propertyType = pt;
  if (r.ownerName) doc.ownerName = r.ownerName;
  if (r.phone) doc.phone = r.phone;
  if (r.address) doc.address = r.address;
  if (r.municipality) doc.municipality = r.municipality;
  if (r.zone) doc.zone = r.zone;
  if (r.price) doc.price = r.price.replace(/\.0+$/, "").trim();
  if (r.features) doc.features = r.features;
  if (r.learnings) doc.learnings = r.learnings;
  if (r.stillListed !== null && r.stillListed !== undefined) doc.stillListed = r.stillListed;
  if (lastContactAt) doc.lastContactAt = lastContactAt;
  const nad = tsFromDate(r.nextActionDate);
  if (nad) doc.nextActionDate = nad;
  return doc;
}

async function main() {
  const recs = load();
  console.log(`Loaded ${recs.length} prospects to import (after exclude-copia + dedupe).`);

  if (DRY_RUN) {
    const now = Timestamp.fromMillis(0);
    const sample = recs.slice(0, 3).map((r) => buildDoc(r, now));
    console.log("DRY RUN — sample of 3 transformed docs:");
    console.log(JSON.stringify(sample, null, 1));
    console.log(`DRY RUN — would write ${recs.length} docs to organizations/${ORG_ID}/prospects (db ${DATABASE_ID}).`);
    return;
  }

  if (admin.apps.length === 0) admin.initializeApp({ projectId: "real-estate-idealista-bot" });
  const db = getFirestore(admin.app(), DATABASE_ID);
  const col = db.collection(`organizations/${ORG_ID}/prospects`);

  const now = Timestamp.now();
  const batchSize = 400;
  let written = 0;
  for (let i = 0; i < recs.length; i += batchSize) {
    const batch = db.batch();
    for (const r of recs.slice(i, i + batchSize)) {
      batch.set(col.doc(), buildDoc(r, now));
    }
    await batch.commit();
    written += Math.min(batchSize, recs.length - i);
    console.log(`Committed ${written}/${recs.length}`);
  }
  console.log(`Done. Imported ${written} prospects to organizations/${ORG_ID}/prospects (importSource=${IMPORT_SOURCE}).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
