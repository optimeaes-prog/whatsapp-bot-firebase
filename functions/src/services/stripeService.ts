import Stripe from "stripe";
import { CreditPackage } from "../types";

// Initialize Stripe with the API key from environment
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
    if (!stripeInstance) {
        const apiKey = process.env.STRIPE_API_KEY;
        if (!apiKey) {
            throw new Error("STRIPE_API_KEY is not defined in environment");
        }
        stripeInstance = new Stripe(apiKey);
    }
    return stripeInstance;
}

// Credit packages available for purchase
export const CREDIT_PACKAGES: CreditPackage[] = [
    {
        id: "credits_50",
        name: "50 Créditos",
        amount: 500,      // €5.00
        credits: 50,
        currency: "eur",
    },
    {
        id: "credits_100",
        name: "100 Créditos",
        amount: 1000,     // €10.00
        credits: 100,
        currency: "eur",
    },
    {
        id: "credits_200",
        name: "200 Créditos",
        amount: 2000,     // €20.00
        credits: 200,
        currency: "eur",
    },
];

/**
 * Create a Stripe Checkout session for purchasing credits
 */
export async function createCheckoutSession(
    userId: string,
    packageId: string,
    successUrl: string,
    cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
    const stripe = getStripe();

    // Find the package
    const creditPackage = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!creditPackage) {
        throw new Error(`Invalid package ID: ${packageId}`);
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
            {
                price_data: {
                    currency: creditPackage.currency,
                    product_data: {
                        name: creditPackage.name,
                        description: `${creditPackage.credits} créditos para tu cuenta`,
                    },
                    unit_amount: creditPackage.amount,
                },
                quantity: 1,
            },
        ],
        metadata: {
            userId,
            packageId,
            credits: creditPackage.credits.toString(),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
    });

    console.log(`Created checkout session ${session.id} for user ${userId}, package ${packageId}`);

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
