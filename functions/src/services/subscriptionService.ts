import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { OrgSubscription, SubscriptionPlanId } from "../types";
import { addOrgConversations } from "./billingService";

const DATABASE_ID = "realestate-whatsapp-bot";

let firestoreInstance: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore {
    if (!firestoreInstance) {
        firestoreInstance = getFirestore(admin.app(), DATABASE_ID);
    }
    return firestoreInstance;
}

/** Monthly conversations granted per subscription plan */
export const PLAN_BASE_CONVERSATIONS: Record<SubscriptionPlanId, number> = {
    free: 40,
    plus: 80,
    pro: 80,
    pro_plus: 80,
};

/**
 * Get the current subscription for an org.
 * Returns null if no subscription record exists (org is on Free plan).
 */
export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
    const doc = await getDb().collection("organizations").doc(orgId).get();
    if (!doc.exists) return null;

    const sub = doc.data()?.subscription;
    if (!sub || !sub.stripeSubscriptionId) return null;

    return sub as OrgSubscription;
}

/**
 * Upsert the subscription fields on the org document.
 */
export async function setOrgSubscription(
    orgId: string,
    data: Partial<OrgSubscription>
): Promise<void> {
    await getDb()
        .collection("organizations")
        .doc(orgId)
        .set(
            {
                subscription: {
                    ...data,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            },
            { merge: true }
        );
    console.log(`[subscriptionService] Subscription updated for org ${orgId}: planId=${data.planId}, status=${data.status}`);
}

/**
 * Mark a Stripe invoice as processed using a dedicated idempotency collection.
 * Returns true if the invoice was new (not yet seen), false if already processed.
 * Uses a Firestore transaction so concurrent webhook retries are safe.
 */
export async function markInvoiceProcessed(orgId: string, invoiceId: string): Promise<boolean> {
    const ref = getDb()
        .collection("organizations")
        .doc(orgId)
        .collection("processedStripeInvoices")
        .doc(invoiceId);

    let isNew = false;

    await getDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) {
            isNew = false;
            return;
        }
        tx.set(ref, { processedAt: admin.firestore.FieldValue.serverTimestamp() });
        isNew = true;
    });

    return isNew;
}

/**
 * Grant the monthly conversations for a given plan, keyed on the Stripe invoice ID.
 * Idempotent: subsequent calls with the same invoiceId are safely ignored.
 */
export async function grantSubscriptionConversations(
    orgId: string,
    planId: SubscriptionPlanId,
    invoiceId: string,
    extraBlocks: number = 0
): Promise<void> {
    const isNew = await markInvoiceProcessed(orgId, invoiceId);
    if (!isNew) {
        console.log(`[subscriptionService] Invoice ${invoiceId} already processed for org ${orgId}. Skipping.`);
        return;
    }

    let conversations = PLAN_BASE_CONVERSATIONS[planId] ?? 0;
    
    if (extraBlocks > 0) {
        conversations += extraBlocks * 40;
    }

    if (conversations === 0) {
        console.warn(`[subscriptionService] No conversations configured for plan ${planId}`);
        return;
    }

    await addOrgConversations(
        conversations,
        `Suscripción: Plan ${planId.toUpperCase()} (Base + ${extraBlocks} packs extra)`,
        orgId
    );

    // Persist extraBlocks on the subscription doc so getSubscription can expose contractedConversations
    await getDb()
        .collection("organizations")
        .doc(orgId)
        .set({ subscription: { extraBlocks } }, { merge: true });

    console.log(`[subscriptionService] Granted ${conversations} conversations to org ${orgId} for plan ${planId}, invoice ${invoiceId}`);
}

/**
 * Calculate the number of prorated conversations to grant immediately when upgrading mid-cycle.
 * Example: upgrading from 200 to 280 conversations with 15 days left out of 30 total
 *          → (280 - 200) * (15/30) = 40 prorated conversations
 */
export function calculateProratedConversations(
    oldContracted: number,
    newContracted: number,
    currentPeriodEndMs: number
): number {
    if (newContracted <= oldContracted) return 0;

    const now = Date.now();
    const periodEnd = currentPeriodEndMs;
    
    // Estimate period start: Stripe periods are typically 1 month or 1 year
    // We need the fraction of the period remaining
    // Use 30 days as approximation for monthly, detect yearly from the period length
    const msRemaining = Math.max(0, periodEnd - now);
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
    
    // Estimate total period length: if remaining > 45 days, assume yearly; otherwise monthly
    const totalDays = daysRemaining > 45 ? 365 : 30;
    const fractionRemaining = Math.min(1, daysRemaining / totalDays);
    
    const extraConversations = newContracted - oldContracted;
    const prorated = Math.round(extraConversations * fractionRemaining);
    
    console.log(`[subscriptionService] Prorated conversations: old=${oldContracted}, new=${newContracted}, daysRemaining=${daysRemaining.toFixed(1)}, fraction=${fractionRemaining.toFixed(3)}, prorated=${prorated}`);
    
    return prorated;
}
