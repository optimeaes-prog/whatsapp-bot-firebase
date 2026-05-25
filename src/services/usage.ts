import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  startAfter,
  where,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getOrganizationBasePath } from "../lib/organization";

export type UsageEventType =
  | "initial_outbound"
  | "intake_outbound"
  | "manual_purchase"
  | "auto_recharge"
  | "subscription_grant"
  | "free_plan_activation"
  | "other";

export type CreditTransaction = {
  id: string;
  type: "deduction" | "purchase";
  amount: number;
  description: string;
  createdAt: Timestamp | null;
  chatId?: string;
  eventType?: UsageEventType;
  idempotencyField?: string;
  actorUid?: string;
  stripeReference?: string;
};

export type LeadSummary = {
  id: string;
  chatId: string;
  name?: string;
  listingCode?: string;
  assignedAgentName?: string;
};

export type GetCreditTransactionsResult = {
  transactions: CreditTransaction[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

function getCreditTransactionsCollection() {
  return `${getOrganizationBasePath()}/creditTransactions`;
}

function getLeadsCollection() {
  return `${getOrganizationBasePath()}/leads`;
}

function getOrgDocPath() {
  return getOrganizationBasePath();
}

export async function getCreditTransactions(opts?: {
  pageSize?: number;
  startAfterDoc?: QueryDocumentSnapshot | null;
}): Promise<GetCreditTransactionsResult> {
  const pageSize = opts?.pageSize ?? 500;
  const colRef = collection(db, getCreditTransactionsCollection());
  const constraints = [orderBy("createdAt", "desc"), limitQuery(pageSize)];
  const q = opts?.startAfterDoc
    ? query(colRef, orderBy("createdAt", "desc"), startAfter(opts.startAfterDoc), limitQuery(pageSize))
    : query(colRef, ...constraints);
  const snap = await getDocs(q);
  const transactions = snap.docs.map((d) => {
    const data = d.data() as Omit<CreditTransaction, "id">;
    return { id: d.id, ...data } as CreditTransaction;
  });
  return {
    transactions,
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

/**
 * Fetches lead summaries for the given chatIds. Firestore `in` accepts up to 30 values per
 * query as of v9+; we chunk to 30 to be safe.
 */
export async function getLeadsByChatIds(chatIds: string[]): Promise<Map<string, LeadSummary>> {
  const result = new Map<string, LeadSummary>();
  const unique = Array.from(new Set(chatIds.filter(Boolean)));
  if (unique.length === 0) return result;

  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const q = query(
      collection(db, getLeadsCollection()),
      where("chatId", "in", chunk)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as {
        chatId?: string;
        name?: string;
        listingCode?: string;
        assignedAgentName?: string;
      };
      if (!data.chatId) return;
      // first match wins; same chatId could appear in multiple leads but unlikely within an org
      if (!result.has(data.chatId)) {
        result.set(data.chatId, {
          id: d.id,
          chatId: data.chatId,
          name: data.name,
          listingCode: data.listingCode,
          assignedAgentName: data.assignedAgentName,
        });
      }
    });
  }
  return result;
}

/**
 * Reads creditBalance directly from the org doc. Used as a fallback when the
 * functions-backed `getAvailableConversations()` is not desirable (extra hop).
 */
export async function getOrgCreditBalance(): Promise<number> {
  const snap = await getDoc(doc(db, getOrgDocPath()));
  if (!snap.exists()) return 0;
  const data = snap.data() as { creditBalance?: number };
  return typeof data.creditBalance === "number" ? data.creditBalance : 0;
}
