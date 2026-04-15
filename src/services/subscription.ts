import { auth } from "../lib/firebase";
import type { AutoRechargeSettings, ConversationPackage, SubscriptionPlanId } from "../types";

export type OrgSubscriptionInfo = {
  planId: SubscriptionPlanId;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodEnd: string | null;
  billingInterval?: "month" | "year";
  /** Total conversations contracted this period (plan base + extra paid blocks) */
  contractedConversations?: number;
  stripeSubscriptionId?: string;
  extraBlocks?: number;
};

export type AutoRechargeInfo = {
  enabled: boolean;
  thresholdConversations: number;
  rechargeConversations: number;
  hasSavedCard: boolean;
};

export type SubscriptionChangePreview = {
  isUpgrade: boolean;
  currentPlanId: string;
  newPlanId: string;
  currentConversations: number;
  newConversations: number;
  proratedAmountCents: number;
  proratedConversations: number;
  renewalDate: string | null;
  billingInterval: "month" | "year";
  newMonthlyPrice: number;
};

export type SubscriptionChangeResult = {
  success: boolean;
  isUpgrade: boolean;
  message: string;
  newPlanId: string;
  newContracted: number;
};

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

/**
 * Get user's current available conversations balance
 */
export async function getAvailableConversations(): Promise<number> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getConversations`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get conversations: ${response.status}`);
    }

    const data = await response.json();
    return data.balance || 0;
}

/**
 * Get available conversation packages
 */
export async function getConversationPackages(): Promise<ConversationPackage[]> {
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
    returnPath: string = "/suscripcion",
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
    planId: SubscriptionPlanId,
    billingInterval: "month" | "year",
    extraBlocks: number = 0,
    returnPath: string = "/onboarding"
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
        body: JSON.stringify({ planId, successUrl, cancelUrl, billingInterval, extraBlocks }),
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
 * Preview a subscription change (upgrade or downgrade).
 * Returns proration details from Stripe.
 */
export async function previewSubscriptionChange(
    newPlanId: SubscriptionPlanId,
    newExtraBlocks: number,
    billingInterval: "month" | "year"
): Promise<SubscriptionChangePreview> {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/previewSubscriptionChange`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPlanId, newExtraBlocks, billingInterval }),
    });

    if (!response.ok) {
        let message = `Error ${response.status}`;
        try {
            const err = await response.json() as { error?: string };
            if (typeof err.error === "string" && err.error.length > 0) message = err.error;
        } catch { /* ignore */ }
        throw new Error(message);
    }

    return response.json();
}

/**
 * Execute a subscription change (upgrade or downgrade).
 * For upgrades, Stripe charges the saved card with the prorated difference.
 * For downgrades, the change is scheduled for end of current period.
 */
export async function updateSubscriptionPlan(
    newPlanId: SubscriptionPlanId,
    newExtraBlocks: number,
    billingInterval: "month" | "year"
): Promise<SubscriptionChangeResult> {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/updateSubscriptionPlan`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPlanId, newExtraBlocks, billingInterval }),
    });

    if (!response.ok) {
        let message = `Error ${response.status}`;
        try {
            const err = await response.json() as { error?: string };
            if (typeof err.error === "string" && err.error.length > 0) message = err.error;
        } catch { /* ignore */ }
        throw new Error(message);
    }

    return response.json();
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
    const response = await fetch(`${FUNCTIONS_BASE_URL}/saveAutoRechargeSettings`, {
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
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getAutoRechargeSettings`, {
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
 * Create a Stripe Billing Portal session for managing an existing subscription
 */
export async function createBillingPortalSession(returnPath: string = "/suscripcion"): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const token = await user.getIdToken();
    const returnUrl = `${window.location.origin}${returnPath}`;
    const response = await fetch(`${FUNCTIONS_BASE_URL}/createBillingPortalSession`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnUrl }),
    });
    if (!response.ok) throw new Error(`Failed to create billing portal session: ${response.status}`);
    const { url } = await response.json();
    return url;
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
