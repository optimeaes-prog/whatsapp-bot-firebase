import { auth } from "../lib/firebase";
import type { AutoRechargeSettings, CreditPackage, SubscriptionPlanId } from "../types";

export type OrgSubscriptionInfo = {
  planId: SubscriptionPlanId;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodEnd: string | null;
};

export type AutoRechargeInfo = {
  enabled: boolean;
  thresholdCredits: number;
  rechargeCredits: number;
  hasSavedCard: boolean;
};

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
export async function createCheckoutSession(
    packageId: string,
    returnPath: string = "/creditos",
    quantity: number = 1
): Promise<string> {
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
            quantity,
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
 * Create a Stripe Checkout session for a subscription plan upgrade
 */
export async function createSubscriptionCheckout(
    planId: string,
    returnPath: string = "/creditos",
    billingInterval: "month" | "year" = "month"
): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const successUrl = `${window.location.origin}${returnPath}?payment=success`;
    const cancelUrl = `${window.location.origin}${returnPath}?payment=cancelled`;

    const response = await fetch(`${FUNCTIONS_BASE_URL}/createSubscriptionCheckout`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, successUrl, cancelUrl, billingInterval }),
    });

    if (!response.ok) {
        let message = `Error ${response.status}`;
        try {
            const err = await response.json() as { error?: string };
            if (typeof err.error === "string" && err.error.length > 0) {
                message = err.error;
            }
        } catch {
            /* ignore */
        }
        throw new Error(message);
    }

    const data = await response.json();
    return data.url;
}

/**
 * Save auto-recharge settings for the current user
 */
export async function saveAutoRecharge(settings: AutoRechargeSettings): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/saveAutoRecharge`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to save auto-recharge settings: ${response.status}`);
    }
}

/**
 * Read auto-recharge toggle, thresholds, and whether Stripe has a saved card on file.
 */
export async function getAutoRecharge(): Promise<AutoRechargeInfo> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getAutoRecharge`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        let message = `Failed to get auto-recharge: ${response.status}`;
        try {
            const err = await response.json() as { error?: string };
            if (typeof err.error === "string" && err.error.length > 0) {
                message = err.error;
            }
        } catch {
            /* ignore */
        }
        throw new Error(message);
    }

    return response.json() as Promise<AutoRechargeInfo>;
}

/**
 * Get the org's current subscription (plan, status, renewal date).
 * Returns Free plan defaults if no subscription is active.
 */
export async function getSubscription(): Promise<OrgSubscriptionInfo> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getSubscription`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get subscription: ${response.status}`);
    }

    return response.json();
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
