import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_DATABASE_ID = "realestate-whatsapp-bot";
const DEFAULT_PROJECT_ID = "real-estate-idealista-bot";

function parseArgs(argv: string[]): {
  dryRun: boolean;
  limit?: number;
  databaseId: string;
  projectId: string;
} {
  const dryRun = argv.includes("--dry-run");
  const databaseIdRaw = argv.find((a) => a.startsWith("--database-id="))?.split("=", 2)[1];
  const databaseId = String(databaseIdRaw || DEFAULT_DATABASE_ID).trim();
  if (!databaseId) throw new Error("--database-id cannot be empty");
  const projectIdRaw = argv.find((a) => a.startsWith("--project-id="))?.split("=", 2)[1];
  const projectId =
    String(projectIdRaw || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID).trim();
  if (!projectId) throw new Error("--project-id cannot be empty");
  const limitRaw = argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1];
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive number");
  }
  return { dryRun, limit, databaseId, projectId };
}

function asNonEmptyString(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : undefined;
}

type BotConfigDoc = {
  assistantAvatarName?: unknown;
  config?: {
    assistantAvatarName?: unknown;
    cloudConfig?: {
      assistantAvatarName?: unknown;
      [key: string]: unknown;
    };
    cloudApiConfig?: {
      assistantAvatarName?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  cloudConfig?: {
    assistantAvatarName?: unknown;
    [key: string]: unknown;
  };
  cloudApiConfig?: {
    assistantAvatarName?: unknown;
    [key: string]: unknown;
  };
  // Some past writes accidentally created literal keys with dots (Firestore console shows them as "config.assistantAvatarName")
  // We keep them typed as unknown so we can detect+delete them.
  "config.assistantAvatarName"?: unknown;
  "config.cloudConfig.assistantAvatarName"?: unknown;
  "config.cloudApiConfig.assistantAvatarName"?: unknown;
  "cloudConfig.assistantAvatarName"?: unknown;
  "cloudApiConfig.assistantAvatarName"?: unknown;
  [key: string]: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasOnlyAssistantAvatarName(v: unknown): boolean {
  return isRecord(v) && Object.keys(v).every((k) => k === "assistantAvatarName");
}

function canDeleteConfigMap(config: unknown): boolean {
  if (!isRecord(config)) return false;
  const keys = Object.keys(config);
  if (keys.length === 0) return true;
  return keys.every((key) => {
    if (key === "assistantAvatarName") return true;
    if (key === "cloudConfig" || key === "cloudApiConfig") return hasOnlyAssistantAvatarName(config[key]);
    return false;
  });
}

async function main(): Promise<void> {
  const { dryRun, limit, databaseId, projectId } = parseArgs(process.argv.slice(2));

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }

  const db = getFirestore(admin.app(), databaseId);

  let orgsSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  try {
    orgsSnap = await db.collection("organizations").select().get();
  } catch (err) {
    const code = (err as { code?: number })?.code;
    const message = (err as { message?: string })?.message || String(err);
    console.error(
      `[migrate-assistantAvatarName] FAILED projectId=${projectId} databaseId=${databaseId} code=${String(code || "")} msg=${message}`
    );
    throw err;
  }
  const orgIds = orgsSnap.docs.map((d) => d.id);
  const targetOrgIds = typeof limit === "number" ? orgIds.slice(0, limit) : orgIds;

  console.log(
    `[migrate-assistantAvatarName] projectId=${projectId} databaseId=${databaseId} orgs=${orgIds.length} target=${targetOrgIds.length} dryRun=${dryRun}`
  );

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  const deleteField = admin.firestore.FieldValue.delete();

  // Keep batch sizes conservative; each org emits at most 1 write.
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let pendingWrites = 0;

  for (const orgId of targetOrgIds) {
    scanned++;
    const ref = db.doc(`organizations/${orgId}/botConfig/config`);
    const snap = await ref.get();
    if (!snap.exists) {
      skipped++;
      continue;
    }

    const data = (snap.data() || {}) as BotConfigDoc;
    const literalTarget = asNonEmptyString(data["config.assistantAvatarName"]);
    const candidates: Array<{ path: string; value?: string }> = [
      { path: "assistantAvatarName", value: asNonEmptyString(data?.assistantAvatarName) },
      { path: "config.assistantAvatarName", value: asNonEmptyString(data?.config?.assistantAvatarName) },
      { path: "config.cloudConfig.assistantAvatarName", value: asNonEmptyString(data?.config?.cloudConfig?.assistantAvatarName) },
      { path: "cloudConfig.assistantAvatarName", value: asNonEmptyString(data?.cloudConfig?.assistantAvatarName) },
      { path: "config.cloudApiConfig.assistantAvatarName", value: asNonEmptyString(data?.config?.cloudApiConfig?.assistantAvatarName) },
      { path: "cloudApiConfig.assistantAvatarName", value: asNonEmptyString(data?.cloudApiConfig?.assistantAvatarName) },
      // literal dotted keys (wrong shape)
      { path: "config.cloudConfig.assistantAvatarName (literal)", value: asNonEmptyString(data["config.cloudConfig.assistantAvatarName"]) },
      { path: "cloudConfig.assistantAvatarName (literal)", value: asNonEmptyString(data["cloudConfig.assistantAvatarName"]) },
      { path: "config.cloudApiConfig.assistantAvatarName (literal)", value: asNonEmptyString(data["config.cloudApiConfig.assistantAvatarName"]) },
      { path: "cloudApiConfig.assistantAvatarName (literal)", value: asNonEmptyString(data["cloudApiConfig.assistantAvatarName"]) },
    ];
    const hit = candidates.find((c) => !!c.value);
    const currentTarget = asNonEmptyString(data?.assistantAvatarName);

    const src = hit?.value || literalTarget;
    if (!src && !literalTarget) {
      skipped++;
      continue;
    }

    const needsWriteTopLevelTarget = !currentTarget && !!src;
    const shouldDeleteConfigMap = canDeleteConfigMap(data.config);
    const needsDeleteNested =
      asNonEmptyString(data?.config?.assistantAvatarName) !== undefined ||
      asNonEmptyString(data?.config?.cloudConfig?.assistantAvatarName) !== undefined ||
      asNonEmptyString(data?.config?.cloudApiConfig?.assistantAvatarName) !== undefined ||
      asNonEmptyString(data?.cloudConfig?.assistantAvatarName) !== undefined ||
      asNonEmptyString(data?.cloudApiConfig?.assistantAvatarName) !== undefined;
    const needsDeleteLiteral =
      asNonEmptyString(data["config.assistantAvatarName"]) !== undefined ||
      asNonEmptyString(data["config.cloudConfig.assistantAvatarName"]) !== undefined ||
      asNonEmptyString(data["config.cloudApiConfig.assistantAvatarName"]) !== undefined ||
      asNonEmptyString(data["cloudConfig.assistantAvatarName"]) !== undefined ||
      asNonEmptyString(data["cloudApiConfig.assistantAvatarName"]) !== undefined;
    if (!needsWriteTopLevelTarget && !shouldDeleteConfigMap && !needsDeleteNested && !needsDeleteLiteral) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] org=${orgId} from=${hit?.path || (literalTarget ? "config.assistantAvatarName (literal)" : "unknown")} writeTopLevel=${needsWriteTopLevelTarget} deleteConfigMap=${shouldDeleteConfigMap} deleteNested=${needsDeleteNested} deleteLiteral=${needsDeleteLiteral} value=${JSON.stringify(src || literalTarget)}`
      );
      updated++;
      continue;
    }

    // Dotted strings are true nested field paths. FieldPath segments delete accidental literal dotted keys.
    const updatePairs: Array<string | admin.firestore.FieldPath | unknown> = [];
    if (needsWriteTopLevelTarget) {
      updatePairs.push("assistantAvatarName", src || literalTarget);
    }
    if (shouldDeleteConfigMap) {
      updatePairs.push("config", deleteField);
    } else {
      updatePairs.push(
        "config.assistantAvatarName",
        deleteField,
        "config.cloudConfig.assistantAvatarName",
        deleteField,
        "config.cloudApiConfig.assistantAvatarName",
        deleteField
      );
    }
    updatePairs.push(
      "cloudConfig.assistantAvatarName",
      deleteField,
      "cloudApiConfig.assistantAvatarName",
      deleteField
    );
    if (needsDeleteLiteral) {
      updatePairs.push(
        new admin.firestore.FieldPath("config.assistantAvatarName"),
        deleteField,
        new admin.firestore.FieldPath("config.cloudConfig.assistantAvatarName"),
        deleteField,
        new admin.firestore.FieldPath("config.cloudApiConfig.assistantAvatarName"),
        deleteField,
        new admin.firestore.FieldPath("cloudConfig.assistantAvatarName"),
        deleteField,
        new admin.firestore.FieldPath("cloudApiConfig.assistantAvatarName"),
        deleteField
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batch as any).update(ref, ...updatePairs);
    pendingWrites++;
    updated++;

    if (pendingWrites >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      pendingWrites = 0;
      console.log(`[progress] scanned=${scanned} updated=${updated} skipped=${skipped}`);
    }
  }

  if (!dryRun && pendingWrites > 0) {
    await batch.commit();
  }

  console.log(`[done] scanned=${scanned} updated=${updated} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

