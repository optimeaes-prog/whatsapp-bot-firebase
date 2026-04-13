import Stripe from "stripe";
import { CreditPackage } from "../types";

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

// Credit packages available for purchase
export const CREDIT_PACKAGES: CreditPackage[] = [
    {
        id: "extra_40",
        name: "40 Conversaciones",
        amount: 1000,     // €10.00
        credits: 40,
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
    quantity: number = 1
): Promise<{ sessionId: string; url: string }> {
    const stripe = getStripe();

    // Find the package
    const creditPackage = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!creditPackage) {
        throw new Error(`Invalid package ID: ${packageId}`);
    }

    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_CHECKOUT_PACKAGE_QUANTITY) {
        throw new Error(`Invalid quantity: must be between 1 and ${MAX_CHECKOUT_PACKAGE_QUANTITY}`);
    }

    const totalCredits = creditPackage.credits * qty;
    const creditsMeta = String(totalCredits);
    const productName = qty === 1 ? creditPackage.name : `${creditPackage.name} × ${qty}`;
    const productDescription =
        qty === 1
            ? `${creditPackage.credits} créditos para tu cuenta`
            : `${totalCredits} créditos (${qty} × ${creditPackage.credits}) para tu cuenta`;

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
                credits: creditsMeta,
            },
        },
        line_items: [
            {
                price_data: {
                    currency: creditPackage.currency,
                    product_data: {
                        name: productName,
                        description: productDescription,
                    },
                    unit_amount: creditPackage.amount,
                },
                quantity: qty,
            },
        ],
        metadata: {
            userId,
            orgId,
            packageId,
            credits: creditsMeta,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
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
 * Get available credit packages
 */
export function getCreditPackages(): CreditPackage[] {
    return CREDIT_PACKAGES;
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

/** Credit package id for auto-recharge (must match a CREDIT_PACKAGES entry). */
export function packageIdForCreditAmount(credits: number): string {
    const pkg = CREDIT_PACKAGES.find((p) => p.credits === credits);
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
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
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
                credits: String(pkg.credits),
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
