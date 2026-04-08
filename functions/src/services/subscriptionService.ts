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

/** Monthly credits granted (base + bonus) per subscription plan */
export const SUBSCRIPTION_CREDITS: Record<SubscriptionPlanId, number> = {
    free: 90,
    plus: 660,      // 600 + 60
    pro: 1320,      // 1200 + 120
    pro_plus: 2640, // 2400 + 240
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
    invoiceId: string
): Promise<void> {
    const isNew = await markInvoiceProcessed(orgId, invoiceId);
    if (!isNew) {
        console.log(`[subscriptionService] Invoice ${invoiceId} already processed for org ${orgId}. Skipping.`);
        return;
    }

    const credits = SUBSCRIPTION_CREDITS[planId] ?? 0;
    if (credits === 0) {
        console.warn(`[subscriptionService] No credits configured for plan ${planId}`);
        return;
    }

    await addOrgCredits(
        credits,
        `Créditos mensuales plan ${planId} (invoice ${invoiceId})`,
        orgId
    );

    console.log(`[subscriptionService] Granted ${credits} credits to org ${orgId} for plan ${planId}, invoice ${invoiceId}`);
}
