import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { UserCredits, CreditTransaction } from "../types";

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
