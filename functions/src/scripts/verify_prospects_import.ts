import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Verify the prospects import.
//   npx ts-node functions/src/scripts/verify_prospects_import.ts

const DATABASE_ID = "realestate-whatsapp-bot";
const ORG_ID = "org_paco_granados";

if (admin.apps.length === 0) admin.initializeApp({ projectId: "real-estate-idealista-bot" });
const db = getFirestore(admin.app(), DATABASE_ID);

async function main() {
  const snap = await db.collection(`organizations/${ORG_ID}/prospects`).get();
  const docs = snap.docs.map((d) => d.data());
  const imported = docs.filter((d) => d.importSource === "xlsx_seguimiento_2026");

  const byStage: Record<string, number> = {};
  let withPhone = 0;
  let withActivity = 0;
  for (const d of imported) {
    byStage[d.stage as string] = (byStage[d.stage as string] || 0) + 1;
    if (d.phone) withPhone++;
    if (Array.isArray(d.activities) && d.activities.length > 0) withActivity++;
  }

  console.log(`Total docs in collection: ${docs.length}`);
  console.log(`Imported (importSource=xlsx_seguimiento_2026): ${imported.length}`);
  console.log(`  with phone: ${withPhone} | with history entry: ${withActivity}`);
  console.log("Stage distribution:");
  for (const [stage, n] of Object.entries(byStage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${stage}`);
  }
  console.log("\nSample (3):");
  for (const d of imported.slice(0, 3)) {
    console.log(`  - ${d.ownerName || "(sin nombre)"} | ${d.operationType} | ${d.stage} | ${d.municipality || "-"} | ${d.phone || "-"} | acts=${(d.activities as unknown[])?.length ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
