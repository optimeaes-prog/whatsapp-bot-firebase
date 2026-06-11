import type { SubscriptionPlanId } from "../types";

/**
 * How many notification numbers an org can attach to a single listing under
 * each plan. Free / Plus / Pro are capped at 1 (a single recipient per anuncio);
 * Pro+ and Enterprise unlock the "Alertas a múltiples números" feature called
 * out on the Subscription page.
 *
 * Mirror lives at `functions/src/services/subscriptionService.ts` —
 * `getMaxListingNotificationNumbers` — keep both in sync if you change the
 * rules. The backend trigger enforces this regardless of UI state.
 */
export function getMaxListingNotificationNumbers(planId: SubscriptionPlanId | undefined | null): number {
  if (planId === "pro_plus" || planId === "enterprise") return 10;
  return 1;
}

export function planAllowsMultipleListingNotifications(
  planId: SubscriptionPlanId | undefined | null
): boolean {
  return getMaxListingNotificationNumbers(planId) > 1;
}
