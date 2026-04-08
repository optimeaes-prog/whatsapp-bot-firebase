import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { UserCredits, CreditTransaction } from "../types";
import { createConfirmedOffSessionTopUp, packageIdForCreditAmount } from "./stripeService";

const DATABASE_ID = "realestate-whatsapp-bot";

let firestoreInstance: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore {
    if (!firestoreInstance) {
        firestoreInstance = getFirestore(admin.app(), DATABASE_ID);
    }
    return firestoreInstance;
}

const ORG_ID = "org_paco_granados";

function getOrgDb() {
  return getDb().collection("organizations").doc(ORG_ID);
}

/**
 * Get user credits balance
 */
export async function getUserCredits(userId: string): Promise<number> {
    const db = getOrgDb();
    const doc = await db.collection("credits").doc(userId).get();

    if (!doc.exists) {
        return 0;
    }

    const data = doc.data() as UserCredits;
    return data.balance || 0;
}

/**
 * Add credits to a user's balance
 */
export async function addCredits(
    userId: string,
    amount: number,
    stripeSessionId?: string,
    description: string = "Credit purchase"
): Promise<number> {
    const db = getOrgDb();
    const creditsRef = db.collection("credits").doc(userId);

    // Use a transaction to ensure atomicity
    const newBalance = await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
        const doc = await transaction.get(creditsRef);
        const currentBalance = doc.exists ? (doc.data() as UserCredits).balance || 0 : 0;
        const updatedBalance = currentBalance + amount;

        transaction.set(creditsRef, {
            userId,
            balance: updatedBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        } as Partial<UserCredits>, { merge: true });

        return updatedBalance;
    });

    // Record the transaction
    const transactionData: Omit<CreditTransaction, "id"> = {
        userId,
        type: "purchase",
        amount,
        stripeSessionId,
        description,
        createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection("creditTransactions").add(transactionData);

    console.log(`Added ${amount} credits to user ${userId}. New balance: ${newBalance}`);
    return newBalance;
}

/**
 * Deduct credits from a user's balance
 * Returns the new balance, or throws if insufficient credits
 */
export async function deductCredits(
    userId: string,
    amount: number,
    description: string = "Credit usage"
): Promise<number> {
    const db = getOrgDb();
    const creditsRef = db.collection("credits").doc(userId);

    const newBalance = await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
        const doc = await transaction.get(creditsRef);
        const currentBalance = doc.exists ? (doc.data() as UserCredits).balance || 0 : 0;

        if (currentBalance < amount) {
            throw new Error(`Insufficient credits. Required: ${amount}, Available: ${currentBalance}`);
        }

        const updatedBalance = currentBalance - amount;

        transaction.set(creditsRef, {
            userId,
            balance: updatedBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        } as Partial<UserCredits>, { merge: true });

        return updatedBalance;
    });

    // Record the transaction
    const transactionData: Omit<CreditTransaction, "id"> = {
        userId,
        type: "deduction",
        amount: -amount,  // Negative for deductions
        description,
        createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection("creditTransactions").add(transactionData);

    console.log(`Deducted ${amount} credits from user ${userId}. New balance: ${newBalance}`);
    return newBalance;
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(
    userId: string,
    limit: number = 50
): Promise<CreditTransaction[]> {
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
    })) as CreditTransaction[];
}

// ==================== ORGANIZATION-LEVEL CREDITS ====================

/**
 * Get organization credit balance
 */
export async function getOrgCredits(orgId: string = ORG_ID): Promise<number> {
    const orgRef = getDb().collection("organizations").doc(orgId);
    const doc = await orgRef.get();

    if (!doc.exists) {
        return 0;
    }

    return doc.data()?.creditBalance || 0;
}

/**
 * Deduct credits from the organization's balance.
 * Returns the new balance, or throws if insufficient credits.
 */
export async function deductOrgCredits(
    amount: number,
    description: string = "Uso de créditos",
    orgId: string = ORG_ID
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

    console.log(`Deducted ${amount} org credits from ${orgId}. New balance: ${newBalance}`);

    void runOrgAutoRechargeIfNeeded(orgId, newBalance).catch((e) =>
        console.error("[auto-recharge] runOrgAutoRechargeIfNeeded:", e)
    );

    return newBalance;
}

/**
 * Add credits to the organization's balance.
 */
export async function addOrgCredits(
    amount: number,
    description: string = "Recarga de créditos",
    orgId: string = ORG_ID
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

    console.log(`Added ${amount} org credits to ${orgId}. New balance: ${newBalance}`);
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

export async function getOrgStripeCustomerId(orgId: string = ORG_ID): Promise<string | undefined> {
    const doc = await getDb().collection("organizations").doc(orgId).get();
    return doc.data()?.stripeCustomerId;
}

export async function getOrgAutoRechargeSettingsForApi(orgId: string = ORG_ID): Promise<{
    enabled: boolean;
    thresholdCredits: number;
    rechargeCredits: number;
    hasSavedCard: boolean;
}> {
    const doc = await getDb().collection("organizations").doc(orgId).get();
    const d = doc.data() ?? {};
    return {
        enabled: !!d.autoRechargeEnabled,
        thresholdCredits:
            typeof d.autoRechargeThresholdCredits === "number" ? d.autoRechargeThresholdCredits : 20,
        rechargeCredits: typeof d.autoRechargeCredits === "number" ? d.autoRechargeCredits : 100,
        hasSavedCard: !!(d.stripeCustomerId && d.stripeDefaultPaymentMethodId),
    };
}

export async function saveOrgAutoRechargeSettings(
    orgId: string,
    settings: { enabled: boolean; thresholdCredits: number; rechargeCredits: number }
): Promise<void> {
    const allowed = new Set([50, 100, 200]);
    const recharge = allowed.has(settings.rechargeCredits) ? settings.rechargeCredits : 100;
    const threshold = Math.max(0, Math.min(50000, Math.floor(settings.thresholdCredits)));
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
 * Idempotent credit grant for a PaymentIntent (auto-recharge + webhook backup).
 */
export async function addOrgCreditsForPaymentIntentOnce(
    orgId: string,
    credits: number,
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
    await addOrgCredits(credits, `${description} · ${paymentIntentId}`, orgId);
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
    const rechargeCredits =
        typeof d.autoRechargeCredits === "number" ? d.autoRechargeCredits : 100;

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

    const packageId = packageIdForCreditAmount(rechargeCredits);
    let pi: Awaited<ReturnType<typeof createConfirmedOffSessionTopUp>>;
    try {
        pi = await createConfirmedOffSessionTopUp(orgId, customerId, pmId, packageId);
    } catch (e) {
        console.error("[auto-recharge] PaymentIntent error:", e);
        return;
    }

    if (pi.status === "succeeded") {
        const credits = parseInt(pi.metadata?.credits ?? "0", 10);
        if (credits > 0) {
            const added = await addOrgCreditsForPaymentIntentOnce(
                orgId,
                credits,
                pi.id,
                `Auto-compra ${credits} créditos`
            );
            if (added) {
                console.log(`[auto-recharge] org ${orgId} +${credits} créditos (pi ${pi.id})`);
            }
        }
    } else {
        console.warn(`[auto-recharge] PI ${pi.id} estado ${pi.status}`);
    }
}
