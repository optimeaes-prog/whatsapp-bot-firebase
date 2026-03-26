import { auth } from "../lib/firebase";
import type { CreditPackage } from "../types";

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

/**
 * Get user's current credit balance
 */
export async function getUserCredits(): Promise<number> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getCredits`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get credits: ${response.status}`);
    }

    const data = await response.json();
    return data.balance || 0;
}

/**
 * Get available credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getPackages`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get packages: ${response.status}`);
    }

    const data = await response.json();
    return data.packages || [];
}

/**
 * Create a Stripe Checkout session and redirect to payment page
 */
export async function createCheckoutSession(packageId: string, returnPath: string = "/creditos"): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const successUrl = `${window.location.origin}${returnPath}?payment=success`;
    const cancelUrl = `${window.location.origin}${returnPath}?payment=cancelled`;

    const response = await fetch(`${FUNCTIONS_BASE_URL}/createStripeCheckout`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            packageId,
            successUrl,
            cancelUrl,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to create checkout: ${response.status}`);
    }

    const data = await response.json();
    return data.url;
}

/**
 * Format price for display
 */
export function formatPrice(amountInCents: number, currency: string): string {
    const amount = amountInCents / 100;
    const currencySymbols: Record<string, string> = {
        eur: "€",
        usd: "$",
        gbp: "£",
    };
    return `${currencySymbols[currency] || currency.toUpperCase()}${amount.toFixed(2)}`;
}
