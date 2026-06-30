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

/**
 * Máximo de anuncios ACTIVOS que puede tener una cuenta según su plan.
 * Free: 1 · Plus: 3 · Pro: 12 · Pro+: 25 · Enterprise: ilimitado (25+).
 *
 * Al intentar activar un anuncio por encima de este tope (crear uno nuevo —que
 * nace activo— o reactivar uno cerrado) la UI bloquea e invita a subir de plan,
 * y el trigger `onListingWritten` del backend lo revierte como red de seguridad.
 *
 * El espejo vive en `functions/src/services/subscriptionService.ts`
 * (`getMaxActiveListings`) — mantén ambos en sync si cambian los números.
 */
export const FREE_MAX_ACTIVE_LISTINGS = 1;

export function getMaxActiveListings(planId: SubscriptionPlanId | undefined | null): number {
  switch (planId) {
    case "enterprise":
      return Number.POSITIVE_INFINITY;
    case "pro_plus":
      return 25;
    case "pro":
      return 12;
    case "plus":
      return 3;
    case "free":
      return FREE_MAX_ACTIVE_LISTINGS;
    default:
      // null/undefined → cuenta sin suscripción, se trata como Free.
      return FREE_MAX_ACTIVE_LISTINGS;
  }
}
