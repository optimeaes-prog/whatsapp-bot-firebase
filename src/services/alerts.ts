import {
    collection,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    doc,
    where,
    Timestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { SystemAlert } from "../types";

function getAlertsCollection() {
    return "system_alerts";
}
export type AlertCatalogStatusRow = {
    key: string;
    subject: string;
    description: string;
    autoTest: { kind: "event" } | { kind: "schedule"; every: string };
    enabled: boolean;
    lastSeverity: string | null;
    lastMessage: string | null;
    lastTimestampMs: number | null;
    countLast24h: number;
};

export async function getAlerts(): Promise<SystemAlert[]> {
    const alertsRef = collection(db, getAlertsCollection());

    // Filter by last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

    const q = query(
        alertsRef,
        where("timestamp", ">=", sevenDaysAgoTimestamp),
        orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    })) as SystemAlert[];
}

export async function deleteAlert(id: string): Promise<void> {
    const alertRef = doc(db, getAlertsCollection(), id);
    await deleteDoc(alertRef);
}

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export async function ignoreChat(chatId: string): Promise<void> {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/ignoreChatForSync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error ignoring chat");
    }
}

export async function getAlertCatalogStatus(params?: { limit?: number }): Promise<{ rows: AlertCatalogStatusRow[]; scanned: number }> {
    const url = new URL(`${FUNCTIONS_BASE_URL}/getAlertCatalogStatus`);
    if (params?.limit) {
        url.searchParams.set("limit", String(params.limit));
    }
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any).error || "Error fetching alert catalog status");
    }
    return response.json();
}

export async function setAlertEnabled(params: { key: string; enabled: boolean }): Promise<void> {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/setAlertEnabled`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any).error || "Error updating alert setting");
    }
}

export type AlertCheckResult =
    | { ok: true; key: string; status: "ok"; checkedAt: string; details?: any }
    | { ok: true; key: string; status: "error" | "unknown" | "not_supported"; checkedAt: string; details?: any }
    | { ok: false; key?: string; error: string };

export type AlertCheckDebugMeta = {
    url: string;
    httpStatus: number | null;
    durationMs: number;
    aborted: boolean;
};

export async function runAlertCheck(
    params: { key: string },
    opts?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<AlertCheckResult & { _meta?: AlertCheckDebugMeta }> {
    const url = `${FUNCTIONS_BASE_URL}/runAlertCheck`;
    const startedAt = performance.now();

    const controller = new AbortController();
    const signals: AbortSignal[] = [controller.signal];
    if (opts?.signal) signals.push(opts.signal);

    const onAbort = () => controller.abort();
    for (const s of signals) {
        if (s.aborted) controller.abort();
        else s.addEventListener("abort", onAbort, { once: true });
    }

    let timeout: any = null;
    const timeoutMs = opts?.timeoutMs ?? 25000;
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeout = setTimeout(() => controller.abort(), timeoutMs);
    }

    let response: Response | null = null;
    let aborted = false;
    try {
        response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
        signal: controller.signal,
        });

        const data = await response.json().catch(() => null);
        const durationMs = Math.round(performance.now() - startedAt);

        if (!response.ok) {
            return {
                ok: false,
                key: params.key,
                error: (data as any)?.error || "Error running alert check",
                _meta: { url, httpStatus: response.status, durationMs, aborted: false },
            };
        }

        return {
            ...(data as AlertCheckResult),
            _meta: { url, httpStatus: response.status, durationMs, aborted: false },
        };
    } catch (e: any) {
        aborted = controller.signal.aborted === true;
        const durationMs = Math.round(performance.now() - startedAt);
        return {
            ok: false,
            key: params.key,
            error: aborted ? "Request aborted (timeout/cancel)" : (e?.message || "Network error"),
            _meta: { url, httpStatus: response?.status ?? null, durationMs, aborted },
        };
    } finally {
        if (timeout) clearTimeout(timeout);
        for (const s of signals) {
            try { s.removeEventListener("abort", onAbort); } catch { }
        }
    }
}
