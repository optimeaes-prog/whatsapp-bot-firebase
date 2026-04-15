import Stripe from "stripe";
import { ConversationPackage } from "../types";

// Initialize Stripe with the API key from environment
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
    if (!stripeInstance) {
        // Secret Manager / copy-paste often adds trailing newlines — breaks TLS/auth to api.stripe.com
        const apiKey = process.env.STRIPE_API_KEY?.replace(/\s+/g, "").trim();
        if (!apiKey) {
            throw new Error("STRIPE_API_KEY is not defined in environment");
        }
        if (apiKey.startsWith("pk_")) {
            throw new Error(
                "STRIPE_API_KEY cannot be a publishable key (pk_…). Use the secret key (sk_test_… / sk_live_…) from Developers → API keys."
            );
        }
        if (apiKey.startsWith("mk_")) {
            throw new Error(
                "STRIPE_API_KEY looks invalid (mk_…). Use your Stripe secret key sk_test_… or sk_live_… from Developers → API keys, then update the Firebase secret STRIPE_API_KEY."
            );
        }
        stripeInstance = new Stripe(apiKey, {
            maxNetworkRetries: 3,
            timeout: 25000,
        });
    }
    return stripeInstance;
}

// Conversation packages available for purchase
export const CONVERSATION_PACKAGES: ConversationPackage[] = [
    {
        id: "extra_40",
        name: "40 Conversaciones",
        amount: 1000,     // €10.00
        conversations: 40,
        currency: "eur",
    },
];

const MAX_CHECKOUT_PACKAGE_QUANTITY = 50;

/**
 * Create a Stripe Checkout session for purchasing credits
 */
export async function createCheckoutSession(
    userId: string,
    orgId: string,
    packageId: string,
    successUrl: string,
    cancelUrl: string,
    existingStripeCustomerId?: string | null,
    quantity: number = 1,
    priceId?: string
): Promise<{ sessionId: string; url: string }> {
    const stripe = getStripe();

    // Find the package
    const pkg = CONVERSATION_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
        throw new Error(`Invalid package ID: ${packageId}`);
    }

    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_CHECKOUT_PACKAGE_QUANTITY) {
        throw new Error(`Invalid quantity: must be between 1 and ${MAX_CHECKOUT_PACKAGE_QUANTITY}`);
    }

    const totalConversations = pkg.conversations * qty;
    const conversationsMeta = String(totalConversations);
    const productName = qty === 1 ? pkg.name : `${pkg.name} × ${qty}`;
    const productDescription =
        qty === 1
            ? `${pkg.conversations} conversaciones para tu cuenta`
            : `${totalConversations} conversaciones (${qty} × ${pkg.conversations}) para tu cuenta`;

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        ...(existingStripeCustomerId
            ? { customer: existingStripeCustomerId }
            : { customer_creation: "always" as const }),
        payment_intent_data: {
            setup_future_usage: "off_session",
            metadata: {
                userId,
                orgId,
                packageId,
                conversations: conversationsMeta,
            },
        },
        line_items: [
            {
                ...(priceId
                    ? { price: priceId.trim() }
                    : {
                        price_data: {
                            currency: pkg.currency,
                            product_data: {
                                name: productName,
                                description: productDescription,
                            },
                            unit_amount: pkg.amount,
                        },
                    }),
                quantity: qty,
            },
        ],
        metadata: {
            userId,
            orgId,
            packageId,
            conversations: conversationsMeta,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
    });

    console.log(`Created checkout session ${session.id} for user ${userId}, package ${packageId} qty ${qty}`);

    return {
        sessionId: session.id,
        url: session.url || "",
    };
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const stripe = getStripe();
    return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Verify webhook signature and return the event
 */
export function constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
): Stripe.Event {
    const stripe = getStripe();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Get available conversation packages
 */
export function getConversationPackages(): ConversationPackage[] {
    return CONVERSATION_PACKAGES;
}

/**
 * Create a Stripe Checkout session for a recurring subscription plan.
 * Uses mode: "subscription" so Stripe handles renewals automatically.
 */
export async function createSubscriptionCheckoutSession(
    orgId: string,
    planId: string,
    lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
    extraBlocks: number,
    successUrl: string,
    cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
    const stripe = getStripe();

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: lineItems,
            metadata: {
                orgId,
                planId,
                extraBlocks: String(extraBlocks),
            },
            subscription_data: {
                metadata: {
                    orgId,
                    planId,
                    extraBlocks: String(extraBlocks),
                },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true,
        });

        console.log(`[stripeService] Created subscription checkout session ${session.id} for org ${orgId}, plan ${planId}`);

        return {
            sessionId: session.id,
            url: session.url || "",
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[stripeService] createSubscriptionCheckoutSession failed:", message);
        throw new Error(
            err instanceof Stripe.errors.StripeError
                ? `${err.message}${err.code ? ` (${err.code})` : ""}`
                : message
        );
    }
}

/** Conversation package id for auto-recharge (must match a CONVERSATION_PACKAGES entry). */
export function packageIdForConversationAmount(conversations: number): string {
    const pkg = CONVERSATION_PACKAGES.find((p) => p.conversations === conversations);
    return pkg?.id ?? "extra_40";
}

/**
 * After Checkout completes, read Customer + default PaymentMethod for off-session auto top-ups.
 */
export async function extractBillingFromCheckoutSession(
    sessionId: string
): Promise<{ stripeCustomerId: string; stripeDefaultPaymentMethodId: string } | null> {
    const stripe = getStripe();
    const sess = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent", "subscription"],
    });

    const customerRaw = sess.customer;
    const customerId = typeof customerRaw === "string" ? customerRaw : customerRaw?.id;
    if (!customerId) {
        return null;
    }

    let paymentMethodId: string | undefined;

    if (sess.mode === "payment") {
        let pi = sess.payment_intent;
        if (typeof pi === "string") {
            pi = await stripe.paymentIntents.retrieve(pi);
        }
        if (pi && typeof pi === "object") {
            const pm = pi.payment_method;
            paymentMethodId = typeof pm === "string" ? pm : pm?.id;
        }
    } else if (sess.mode === "subscription") {
        let sub = sess.subscription;
        if (typeof sub === "string") {
            sub = await stripe.subscriptions.retrieve(sub, { expand: ["default_payment_method"] });
        }
        if (sub && typeof sub === "object") {
            const dpm = sub.default_payment_method;
            paymentMethodId = typeof dpm === "string" ? dpm : dpm?.id;
        }
    }

    if (!paymentMethodId) {
        console.warn(`[stripeService] No payment method on checkout session ${sessionId}`);
        return null;
    }

    return { stripeCustomerId: customerId, stripeDefaultPaymentMethodId: paymentMethodId };
}

/**
 * Charge the saved card off-session (auto top-up). Caller must handle idempotent credit grant.
 */
export async function createConfirmedOffSessionTopUp(
    orgId: string,
    customerId: string,
    paymentMethodId: string,
    packageId: string
): Promise<Stripe.PaymentIntent> {
    const pkg = CONVERSATION_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
        throw new Error(`Invalid package ID: ${packageId}`);
    }
    const stripe = getStripe();
    const idempotencyKey = `auto-topup-${orgId}-${Math.floor(Date.now() / 120000)}`;

    return stripe.paymentIntents.create(
        {
            amount: pkg.amount,
            currency: pkg.currency,
            customer: customerId,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
                orgId,
                packageId,
                conversations: String(pkg.conversations),
                source: "auto_recharge",
            },
        },
        { idempotencyKey }
    );
}

export async function createBillingPortalSession(
    orgId: string,
    customerId: string,
    returnUrl: string
): Promise<{ url: string }> {
    const stripe = getStripe();
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        console.log(`[stripeService] Billing portal session created for org ${orgId}`);
        return { url: session.url };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[stripeService] createBillingPortalSession failed:", message);
        throw new Error(
            err instanceof Stripe.errors.StripeError
                ? `${err.message}${err.code ? ` (${err.code})` : ""}`
                : message
        );
    }
}

/**
 * Preview the prorated amount for a subscription change using Stripe's invoice preview API.
 * Uses `invoices.createPreview` (Stripe v20+) with subscription_details.
 * Returns the amount_due in cents, the period end, and currency.
 */
export async function previewSubscriptionProration(
    subscriptionId: string,
    newItems: { price: string; quantity: number }[]
): Promise<{ amountDue: number; periodEnd: number; currency: string }> {
    const stripe = getStripe();

    // Retrieve current subscription to get existing items and period info
    const currentSub = await stripe.subscriptions.retrieve(subscriptionId);

    // Get current_period_end from the first subscription item
    const periodEnd = currentSub.items.data[0]?.current_period_end ?? 0;

    // Build subscription_details.items: delete existing, add new
    const detailItems: Stripe.InvoiceCreatePreviewParams.SubscriptionDetails.Item[] = [];

    for (const existingItem of currentSub.items.data) {
        detailItems.push({ id: existingItem.id, deleted: true });
    }
    for (const ni of newItems) {
        detailItems.push({ price: ni.price, quantity: ni.quantity });
    }

    const previewInvoice = await stripe.invoices.createPreview({
        subscription: subscriptionId,
        subscription_details: {
            items: detailItems,
            proration_behavior: "create_prorations",
        },
    });

    return {
        amountDue: previewInvoice.amount_due,
        periodEnd,
        currency: previewInvoice.currency,
    };
}

/**
 * Update an existing Stripe subscription (upgrade or downgrade).
 * For upgrades: prorate immediately and charge the difference.
 * For downgrades: schedule change for end of current period (no refund).
 * Returns the updated subscription including items with current_period_end.
 */
export async function updateExistingSubscription(
    subscriptionId: string,
    newItems: { price: string; quantity: number }[],
    isUpgrade: boolean
): Promise<Stripe.Subscription> {
    const stripe = getStripe();

    // Retrieve current subscription to get existing items
    const currentSub = await stripe.subscriptions.retrieve(subscriptionId);

    // Build item updates: replace all existing items with new ones
    const items: Stripe.SubscriptionUpdateParams.Item[] = [];

    for (const existingItem of currentSub.items.data) {
        items.push({ id: existingItem.id, deleted: true });
    }
    for (const ni of newItems) {
        items.push({ price: ni.price, quantity: ni.quantity });
    }

    if (isUpgrade) {
        // Upgrade: prorate immediately, Stripe charges saved card
        return stripe.subscriptions.update(subscriptionId, {
            items,
            proration_behavior: "create_prorations",
            payment_behavior: "pending_if_incomplete",
        });
    } else {
        // Downgrade: apply at end of period, no proration/refund
        return stripe.subscriptions.update(subscriptionId, {
            items,
            proration_behavior: "none",
            billing_cycle_anchor: "unchanged",
        });
    }
}

