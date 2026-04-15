import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getActiveOrgId } from "./requestContext";
import { UserConversations, ConversationTransaction } from "../types";
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

function getOrgDb() {
  return getDb().collection("organizations").doc(getActiveOrgId());
}

/**
 * Get user conversations balance
 */
export async function getUserConversationBalance(userId: string): Promise<number> {
    const db = getOrgDb();
    const doc = await db.collection("credits").doc(userId).get();

    if (!doc.exists) {
        return 0;
    }

    const data = doc.data() as UserConversations;
    return data.balance || 0;
}

/**
 * Add conversations to a user's balance
 */
export async function addConversations(
    userId: string,
    amount: number,
    stripeSessionId?: string,
    description: string = "Conversation pack purchase"
): Promise<number> {
    const db = getOrgDb();
    const creditsRef = db.collection("credits").doc(userId);

    // Use a transaction to ensure atomicity
    const newBalance = await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
        const doc = await transaction.get(creditsRef);
        const currentBalance = doc.exists ? (doc.data() as UserConversations).balance || 0 : 0;
        const updatedBalance = currentBalance + amount;

        transaction.set(creditsRef, {
            userId,
            balance: updatedBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        } as Partial<UserConversations>, { merge: true });

        return updatedBalance;
    });

    // Record the transaction
    const transactionData: Omit<ConversationTransaction, "id"> = {
        userId,
        type: "purchase",
        amount,
        stripeSessionId,
        description,
        createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection("creditTransactions").add(transactionData);

    console.log(`Added ${amount} conversations to user ${userId}. New balance: ${newBalance}`);
    return newBalance;
}

/**
 * Deduct conversations from a user's balance
 * Returns the new balance, or throws if insufficient conversations
 */
export async function deductConversations(
    userId: string,
    amount: number,
    description: string = "Conversation usage"
): Promise<number> {
    const db = getOrgDb();
    const creditsRef = db.collection("credits").doc(userId);

    const newBalance = await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
        const doc = await transaction.get(creditsRef);
        const currentBalance = doc.exists ? (doc.data() as UserConversations).balance || 0 : 0;

        if (currentBalance < amount) {
            throw new Error(`Insufficient credits. Required: ${amount}, Available: ${currentBalance}`);
        }

        const updatedBalance = currentBalance - amount;

        transaction.set(creditsRef, {
            userId,
            balance: updatedBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        } as Partial<UserConversations>, { merge: true });

        return updatedBalance;
    });

    // Record the transaction
    const transactionData: Omit<ConversationTransaction, "id"> = {
        userId,
        type: "deduction",
        amount: -amount,  // Negative for deductions
        description,
        createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection("creditTransactions").add(transactionData);

    console.log(`Deducted ${amount} conversations from user ${userId}. New balance: ${newBalance}`);
    return newBalance;
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(
    userId: string,
    limit: number = 50
): Promise<ConversationTransaction[]> {
    const db = getOrgDb();
    const snapshot = await db
        .collection("creditTransactions")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as ConversationTransaction[];
}

// ==================== ORGANIZATION-LEVEL CREDITS ====================

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
    orgId: string = getActiveOrgId()
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
    await getDb().collection("organizations").doc(orgId).collection("creditTransactions").add({
        type: "deduction",
        amount: -amount,
        description,
        createdAt: admin.firestore.Timestamp.now(),
    });

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
    orgId: string = getActiveOrgId()
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
    await getDb().collection("organizations").doc(orgId).collection("creditTransactions").add({
        type: "purchase",
        amount,
        description,
        createdAt: admin.firestore.Timestamp.now(),
    });

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
    await addOrgConversations(conversations, `${description} · ${paymentIntentId}`, orgId);
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
