import type { SubscriptionPlanId } from "../types";

export type BillingInterval = "month" | "year";

export interface CheckoutIntent {
  planId: SubscriptionPlanId;
  billingInterval: BillingInterval;
  extraBlocks: number;
}

const CHECKOUT_INTENT_KEY = "proplead_checkout_intent";

export function saveCheckoutIntent(intent: CheckoutIntent) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent));
  }
}

export function getCheckoutIntent(): CheckoutIntent | null {
  if (typeof window !== "undefined") {
    const data = localStorage.getItem(CHECKOUT_INTENT_KEY);
    if (data) {
      try {
        return JSON.parse(data) as CheckoutIntent;
      } catch (err) {
        console.error("Error parsing checkout intent", err);
      }
    }
  }
  return null;
}

export function clearCheckoutIntent() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CHECKOUT_INTENT_KEY);
  }
}
