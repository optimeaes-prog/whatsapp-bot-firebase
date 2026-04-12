import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { OrgSubscription, SubscriptionPlanId } from "../types";
import { addOrgCredits } from "./creditsService";

const DATABASE_ID = "realestate-whatsapp-bot";

let firestoreInstance: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore {
    if (!firestoreInstance) {
        firestoreInstance = getFirestore(admin.app(), DATABASE_ID);
    }
    return firestoreInstance;
}

/** Monthly credits granted per subscription plan */
export const SUBSCRIPTION_CREDITS: Record<SubscriptionPlanId, number> = {
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
 * Grant the monthly credits for a given plan, keyed on the Stripe invoice ID.
 * Idempotent: subsequent calls with the same invoiceId are safely ignored.
 */
export async function grantSubscriptionCredits(
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

    let credits = SUBSCRIPTION_CREDITS[planId] ?? 0;
    
    if (extraBlocks > 0) {
        credits += extraBlocks * 40;
    }

    if (credits === 0) {
        console.warn(`[subscriptionService] No credits configured for plan ${planId}`);
        return;
    }

    await addOrgCredits(
        credits,
        `Suscripción: Plan ${planId.toUpperCase()} (Base + ${extraBlocks} packs extra)`,
        orgId
    );

    console.log(`[subscriptionService] Granted ${credits} credits to org ${orgId} for plan ${planId}, invoice ${invoiceId}`);
}
