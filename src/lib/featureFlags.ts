// Centralised feature-flag reads. Each flag is a tiny exported helper so all
// callers grep to one place when we flip or remove it. The convention in the
// rest of the app is inline `import.meta.env.VITE_*` — that's fine for one-off
// reads, but flags that gate a multi-PR rollout (e.g. notification-numbers v2)
// benefit from a single source of truth.

function flagOn(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

/**
 * PR 2–4 rollout flag for the verified notification numbers refactor.
 *
 * When ON:
 * - Onboarding step 2 verifies the WhatsApp summaries phone via Twilio Verify.
 * - Organización page shows the new "Números de notificación" panel and hides the
 *   per-member `qualifiedLeadNotificationNumbers` input.
 * - Listings (later) require an explicit notificationNumberIds selection.
 *
 * Flip to "1" in `.env.local` once PR 2 has been smoke-tested locally; in prod
 * the flag stays off until the backfill (PR 3) ships.
 */
export function isNotificationNumbersV2Enabled(): boolean {
  return flagOn(
    (import.meta.env.VITE_NOTIFICATION_NUMBERS_V2 as string | undefined) ?? undefined
  );
}
