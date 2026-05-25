import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getActiveOrgId } from "./requestContext";
import { normalizeToCanonicalChatId } from "../utils";
import { createConfirmedOffSessionTopUp, packageIdForConversationAmount } from "./stripeService";
import { sendLowBalanceNotification } from "./emailService";

const DATABASE_ID = "realestate-whatsapp-bot";

let firestoreInstance: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore {
    if (!firestoreInstance) {
        firestoreInstance = getFirestore(admin.app(), DATABASE_ID);
    }
    return firestoreInstance;
}

// ==================== ORGANIZATION-LEVEL CREDITS ====================

/** Credits charged once per conversation per chargeable event (intake send, initial outbound, etc.). */
export const CREDITS_PER_INITIAL_OUTBOUND = 1;

/**
 * Idempotency field names allowed on the conversation document. Each field represents
 * a distinct chargeable event for the same chatId, so a single conversation can be
 * billed multiple times (e.g. cross-org handoff: 1 credit for the Proplead intake send
 * + 1 credit for the destination org's own initial outbound = 2 total to destination).
 */
export type CreditIdempotencyField =
    | "initialOutboundCreditsDeducted"   // destination org's own first template
    | "intakeOutboundCreditsDeducted";   // Proplead global-intake send, billed to destination at handoff

/**
 * Stable category for ledger entries — surfaced in the Usage page UI. Independent
 * from the free-form `description`, which is intended for humans.
 */
export type CreditEventType =
    | "initial_outbound"
    | "intake_outbound"
    | "manual_purchase"
    | "auto_recharge"
    | "subscription_grant"
    | "free_plan_activation"
    | "other";

function eventTypeForIdempotencyField(field: CreditIdempotencyField): CreditEventType {
    return field === "intakeOutboundCreditsDeducted" ? "intake_outbound" : "initial_outbound";
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
    return out;
}

/**
 * Idempotent: charges {@link CREDITS_PER_INITIAL_OUTBOUND} once per (chatId, idempotencyField)
 * on the org ledger. Different idempotency fields allow charging multiple credits per chatId
 * without double-billing the same event.
 */
export async function deductOrgConversationOnce(
    orgId: string,
    chatId: string,
    idempotencyField: CreditIdempotencyField,
    description: string,
    meta?: { actorUid?: string }
): Promise<"deducted" | "already_charged"> {
    if (!orgId) {
        throw new Error("deductOrgConversationOnce: orgId is required");
    }
    const canonicalChatId = normalizeToCanonicalChatId(chatId);
    const db = getDb();
    const orgRef = db.collection("organizations").doc(orgId);
    const convRef = orgRef.collection("conversations").doc(canonicalChatId);
    const amount = CREDITS_PER_INITIAL_OUTBOUND;

    const outcome = await db.runTransaction(async (transaction) => {
        const convSnap = await transaction.get(convRef);
        if (convSnap.exists && convSnap.data()?.[idempotencyField] === true) {
            return { kind: "already_charged" as const, newBalance: null as number | null };
        }

        const orgSnap = await transaction.get(orgRef);
        const currentBalance = orgSnap.exists ? orgSnap.data()?.creditBalance || 0 : 0;
        if (currentBalance < amount) {
            throw new Error(`Créditos insuficientes. Necesarios: ${amount}, Disponibles: ${currentBalance}`);
        }

        const updatedBalance = currentBalance - amount;
        transaction.update(orgRef, {
            creditBalance: updatedBalance,
            creditBalanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(convRef, { [idempotencyField]: true }, { merge: true });
        return { kind: "deducted" as const, newBalance: updatedBalance };
    });

    if (outcome.kind === "already_charged") {
        return "already_charged";
    }

    await orgRef.collection("creditTransactions").add(stripUndefined({
        type: "deduction",
        amount: -amount,
        description,
        createdAt: admin.firestore.Timestamp.now(),
        chatId: canonicalChatId,
        eventType: eventTypeForIdempotencyField(idempotencyField),
        idempotencyField,
        actorUid: meta?.actorUid,
    }));

    console.log(
        `[billingService] Deduction (${idempotencyField}) for org ${orgId} chat ${canonicalChatId}. New balance: ${outcome.newBalance}`
    );

    if (outcome.newBalance! < 20) {
        void handleLowBalanceAlert(orgId, outcome.newBalance!).catch((e) =>
            console.error("[billingService] handleLowBalanceAlert error:", e)
        );
    }

    void runOrgAutoRechargeIfNeeded(orgId, outcome.newBalance!).catch((e) =>
        console.error("[auto-recharge] runOrgAutoRechargeIfNeeded:", e)
    );

    return "deducted";
}

/**
 * Back-compat wrapper for the destination-org's own first template send.
 * Prefer {@link deductOrgConversationOnce} directly for new call sites.
 */
export async function deductOrgConversationForInitialOutboundOnce(
    orgId: string,
    chatId: string,
    description: string = "Initial outbound (new lead)"
): Promise<"deducted" | "already_charged"> {
    return deductOrgConversationOnce(orgId, chatId, "initialOutboundCreditsDeducted", description);
}

/**
 * Get organization conversation balance
 */
export async function getOrgConversationBalance(orgId: string = getActiveOrgId()): Promise<number> {
    const orgRef = getDb().collection("organizations").doc(orgId);
    const doc = await orgRef.get();

    if (!doc.exists) {
        return 0;
    }

    return doc.data()?.creditBalance || 0;
}

/**
 * Deduct conversations from the organization's balance.
 * Returns the new balance, or throws if insufficient conversations.
 */
export async function deductOrgConversations(
    amount: number,
    description: string = "Uso de conversaciones",
    orgId: string = getActiveOrgId(),
    meta?: { eventType?: CreditEventType; chatId?: string; actorUid?: string }
): Promise<number> {
    const orgRef = getDb().collection("organizations").doc(orgId);

    const newBalance = await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
        const doc = await transaction.get(orgRef);
        const currentBalance = doc.exists ? doc.data()?.creditBalance || 0 : 0;

        if (currentBalance < amount) {
            throw new Error(`Créditos insuficientes. Necesarios: ${amount}, Disponibles: ${currentBalance}`);
        }

        const updatedBalance = currentBalance - amount;

        transaction.update(orgRef, {
            creditBalance: updatedBalance,
            creditBalanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return updatedBalance;
    });

    // Log the transaction
    await getDb().collection("organizations").doc(orgId).collection("creditTransactions").add(stripUndefined({
        type: "deduction",
        amount: -amount,
        description,
        createdAt: admin.firestore.Timestamp.now(),
        eventType: meta?.eventType ?? "other",
        chatId: meta?.chatId,
        actorUid: meta?.actorUid,
    }));

    console.log(`Deducted ${amount} org conversations from ${orgId}. New balance: ${newBalance}`);

    // --- LOW BALANCE ALERT (< 20) ---
    if (newBalance < 20) {
        void handleLowBalanceAlert(orgId, newBalance).catch((e) =>
            console.error("[billingService] handleLowBalanceAlert error:", e)
        );
    }

    void runOrgAutoRechargeIfNeeded(orgId, newBalance).catch((e) =>
        console.error("[auto-recharge] runOrgAutoRechargeIfNeeded:", e)
    );

    return newBalance;
}

/**
 * Sends a notification if the balance is low, with a cooldown.
 */
async function handleLowBalanceAlert(orgId: string, balance: number) {
    const orgRef = getDb().collection("organizations").doc(orgId);
    const snap = await orgRef.get();
    if (!snap.exists) return;

    const data = snap.data()!;
    const lastAlert = data.lowBalanceAlertLastSentAt?.toMillis() || 0;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

    if (Date.now() - lastAlert > cooldownMs) {
        console.log(`[billingService] Triggering low balance notification for org ${orgId} (balance: ${balance})`);
        await sendLowBalanceNotification(orgId, balance);
        await orgRef.update({
            lowBalanceAlertLastSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

/**
 * Add conversations to the organization's balance.
 */
export async function addOrgConversations(
    amount: number,
    description: string = "Recarga de conversaciones",
    orgId: string = getActiveOrgId(),
    meta?: { eventType?: CreditEventType; actorUid?: string; stripeReference?: string }
): Promise<number> {
    const orgRef = getDb().collection("organizations").doc(orgId);

    const newBalance = await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
        const doc = await transaction.get(orgRef);
        const currentBalance = doc.exists ? doc.data()?.creditBalance || 0 : 0;
        const updatedBalance = currentBalance + amount;

        transaction.set(orgRef, {
            creditBalance: updatedBalance,
            creditBalanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return updatedBalance;
    });

    // Log the transaction
    await getDb().collection("organizations").doc(orgId).collection("creditTransactions").add(stripUndefined({
        type: "purchase",
        amount,
        description,
        createdAt: admin.firestore.Timestamp.now(),
        eventType: meta?.eventType ?? "manual_purchase",
        actorUid: meta?.actorUid,
        stripeReference: meta?.stripeReference,
    }));

    console.log(`Added ${amount} org conversations to ${orgId}. New balance: ${newBalance}`);
    return newBalance;
}

// ==================== AUTO-RECHARGE & STRIPE BILLING ====================

export async function mergeOrgStripeBillingFields(
    orgId: string,
    stripeCustomerId: string,
    stripeDefaultPaymentMethodId: string
): Promise<void> {
    await getDb()
        .collection("organizations")
        .doc(orgId)
        .set(
            {
                stripeCustomerId,
                stripeDefaultPaymentMethodId,
            },
            { merge: true }
        );
}

export async function getOrgStripeCustomerId(orgId: string = getActiveOrgId()): Promise<string | undefined> {
    const doc = await getDb().collection("organizations").doc(orgId).get();
    return doc.data()?.stripeCustomerId;
}

export async function getOrgAutoRechargeSettingsForApi(orgId: string = getActiveOrgId()): Promise<{
    enabled: boolean;
    thresholdConversations: number;
    rechargeConversations: number;
    hasSavedCard: boolean;
}> {
    const doc = await getDb().collection("organizations").doc(orgId).get();
    const d = doc.data() ?? {};
    return {
        enabled: !!d.autoRechargeEnabled,
        thresholdConversations:
            typeof d.autoRechargeThresholdCredits === "number" ? d.autoRechargeThresholdCredits : 20,
        rechargeConversations: typeof d.autoRechargeCredits === "number" ? d.autoRechargeCredits : 40,
        hasSavedCard: !!(d.stripeCustomerId && d.stripeDefaultPaymentMethodId),
    };
}

export async function saveOrgAutoRechargeSettings(
    orgId: string,
    settings: { enabled: boolean; thresholdConversations: number; rechargeConversations: number }
): Promise<void> {
    const allowed = new Set([40, 80, 120]);
    const recharge = allowed.has(settings.rechargeConversations) ? settings.rechargeConversations : 40;
    const threshold = Math.max(0, Math.min(50000, Math.floor(settings.thresholdConversations)));
    await getDb()
        .collection("organizations")
        .doc(orgId)
        .set(
            {
                autoRechargeEnabled: settings.enabled,
                autoRechargeThresholdCredits: threshold,
                autoRechargeCredits: recharge,
            },
            { merge: true }
        );
}

/**
 * Idempotent conversation grant for a PaymentIntent (auto-recharge + webhook backup).
 */
export async function addOrgConversationsForPaymentIntentOnce(
    orgId: string,
    conversations: number,
    paymentIntentId: string,
    description: string
): Promise<boolean> {
    const ref = getDb()
        .collection("organizations")
        .doc(orgId)
        .collection("fulfilledPaymentIntents")
        .doc(paymentIntentId);
    try {
        await ref.create({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e: unknown) {
        const err = e as { code?: number; message?: string };
        if (err.code === 6 || String(err.message ?? "").includes("ALREADY_EXISTS")) {
            return false;
        }
        throw e;
    }
    await addOrgConversations(conversations, `${description} · ${paymentIntentId}`, orgId, {
        eventType: "auto_recharge",
        stripeReference: paymentIntentId,
    });
    return true;
}

export async function runOrgAutoRechargeIfNeeded(orgId: string, balanceAfterDeduction: number): Promise<void> {
    const orgRef = getDb().collection("organizations").doc(orgId);
    const snap = await orgRef.get();
    if (!snap.exists) {
        return;
    }
    const d = snap.data()!;
    if (!d.autoRechargeEnabled) {
        return;
    }

    const threshold =
        typeof d.autoRechargeThresholdCredits === "number" ? d.autoRechargeThresholdCredits : 20;
    const rechargeConversations =
        typeof d.autoRechargeCredits === "number" ? d.autoRechargeCredits : 40;

    if (balanceAfterDeduction >= threshold) {
        return;
    }

    const customerId = d.stripeCustomerId as string | undefined;
    const pmId = d.stripeDefaultPaymentMethodId as string | undefined;
    if (!customerId || !pmId) {
        console.warn(
            `[auto-recharge] org ${orgId}: activada pero sin tarjeta guardada (compra con tarjeta antes)`
        );
        return;
    }

    const lastMs = d.autoRechargeLastAttemptAt?.toMillis?.() ?? 0;
    if (Date.now() - lastMs < 2 * 60 * 1000) {
        return;
    }

    await orgRef.update({
        autoRechargeLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const packageId = packageIdForConversationAmount(rechargeConversations);
    let pi: Awaited<ReturnType<typeof createConfirmedOffSessionTopUp>>;
    try {
        pi = await createConfirmedOffSessionTopUp(orgId, customerId, pmId, packageId);
    } catch (e) {
        console.error("[auto-recharge] PaymentIntent error:", e);
        return;
    }

    if (pi.status === "succeeded") {
        const conversations = parseInt(pi.metadata?.conversations ?? "0", 10);
        if (conversations > 0) {
            const added = await addOrgConversationsForPaymentIntentOnce(
                orgId,
                conversations,
                pi.id,
                `Auto-compra ${conversations} conversaciones`
            );
            if (added) {
                console.log(`[auto-recharge] org ${orgId} +${conversations} conversaciones (pi ${pi.id})`);
            }
        }
    } else {
        console.warn(`[auto-recharge] PI ${pi.id} estado ${pi.status}`);
    }
}
