import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const FUNCTIONS_BASE_URL =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
  "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

const COLLECTION = "twilioMigrationJobs";

export type TwilioMigrationJobStatus =
  | "pending"
  | "templates_snapshotted"
  | "templates_submitted"
  | "awaiting_approval"
  | "complete"
  | "failed";

export type TwilioTemplateApprovalStatus =
  | "not_submitted"
  | "received"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";

export interface TwilioMigrationTemplateState {
  sourceSid: string;
  newSid?: string;
  approvalStatus: TwilioTemplateApprovalStatus;
  approvalRejectionReason?: string;
  friendlyName: string;
  language: string;
  mappedSlot?: string;
  is8VarAgentNotification?: boolean;
  submittedAt?: unknown;
  approvedAt?: unknown;
  lastPolledAt?: unknown;
}

export interface TwilioMigrationJob {
  status: TwilioMigrationJobStatus;
  targetOrgId: string;
  sourceOrgId: string;
  newAccountSid: string;
  newWhatsappNumber: string;
  newSenderSid?: string;
  authTokenSecretName: string;
  createdBy: { uid: string; email?: string };
  createdAt?: unknown;
  updatedAt?: unknown;
  webhookConfigured: boolean;
  templates: Record<string, TwilioMigrationTemplateState>;
  errors: Array<{ at: unknown; step: string; message: string }>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function startTwilioSenderMigration(params: {
  targetOrgId: string;
  sourceOrgId: string;
  newAccountSid: string;
  newAuthToken: string;
}): Promise<{
  jobId: string;
  resumed: boolean;
  newSenderSid: string;
  newWhatsappNumber: string;
  totalTemplates: number;
  submittedTemplates: number;
}> {
  const headers = await authHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/startTwilioSenderMigration`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
  return body;
}

export async function submitTwilioMigrationTemplates(params: {
  jobId: string;
  friendlyNames?: string[];
}): Promise<{ total: number; submitted: number; skipped: number }> {
  const headers = await authHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/submitTwilioMigrationTemplates`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
  return body;
}

export async function pollTwilioMigrationJob(jobId: string): Promise<{ updated: number; complete: boolean }> {
  const headers = await authHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/pollTwilioMigrationJob`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
  return body;
}

export async function forceCompleteTwilioMigrationJob(jobId: string): Promise<{ ok: true }> {
  const headers = await authHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/forceCompleteTwilioMigrationJob`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
  return body;
}

export async function retryTwilioMigrationStep(jobId: string, step: string): Promise<{ ok: true }> {
  const headers = await authHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/retryTwilioMigrationStep`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, step }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
  return body;
}

/**
 * Live-subscribe to a migration job doc. Returns the Firestore unsubscribe function.
 */
export function subscribeTwilioMigrationJob(
  jobId: string,
  cb: (job: TwilioMigrationJob | null) => void
): () => void {
  return onSnapshot(doc(db, COLLECTION, jobId), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(snap.data() as TwilioMigrationJob);
  });
}

export type TwilioMigrationJobSummary = TwilioMigrationJob & { id: string };

/**
 * List migration jobs, newest first. Admins/super-admins only (enforced by
 * Firestore rules). Returns up to `max` jobs (default 25).
 *
 * Optionally filter by `targetOrgId` and/or by "in-flight only" (everything
 * except `complete` / `failed`).
 */
export async function listTwilioMigrationJobs(options?: {
  targetOrgId?: string;
  inFlightOnly?: boolean;
  max?: number;
}): Promise<TwilioMigrationJobSummary[]> {
  const max = Math.max(1, Math.min(options?.max ?? 25, 200));
  // Strategy: avoid composite indexes for the in-flight filter by sorting
  // client-side. With `where(status in [...]) + orderBy(createdAt)` Firestore
  // requires a composite index that can be slow to build; the in-flight set is
  // small, so client-side sort is fine and works without waiting on indexes.
  const constraints = [];
  if (options?.targetOrgId) constraints.push(where("targetOrgId", "==", options.targetOrgId));
  if (options?.inFlightOnly) {
    constraints.push(
      where("status", "in", [
        "pending",
        "templates_snapshotted",
        "templates_submitted",
        "awaiting_approval",
      ])
    );
    // No orderBy: fetch up to 200 in-flight jobs then sort + trim in memory.
    constraints.push(fsLimit(Math.max(max, 200)));
  } else {
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(fsLimit(max));
  }
  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as TwilioMigrationJob) }));
  if (options?.inFlightOnly) {
    rows.sort((a, b) => millisOf(b.createdAt) - millisOf(a.createdAt));
    return rows.slice(0, max);
  }
  return rows;
}

function millisOf(value: unknown): number {
  if (!value) return 0;
  const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v._seconds === "number") return v._seconds * 1000;
  return 0;
}
