// GA4 + Consent Mode v2 wrapper.
//
// gtag.js is loaded statically from index.html with consent default = denied
// for the 4 required signals. Until the user grants consent through the cookie
// banner, gtag internally blocks hits as cookieless pings (no _ga cookie).
// This module never injects scripts dynamically — that's the anti-pattern that
// caused the 4h debugging session in Propglow.

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
  }
}

const GA_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ||
  "G-7JTKQSCGPH";

function hasGtag(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

function hasFbq(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  if (hasGtag()) {
    window.gtag("event", name, params);
  }
  trackMeta(name, params);
}

// Map our internal event names to Meta's standard events. Anything not in this
// map is sent as a Meta Custom Event with the same name.
const META_STANDARD_EVENTS: Record<string, string> = {
  sign_up: "CompleteRegistration",
  login: "Lead",
  begin_checkout: "InitiateCheckout",
  payment_success: "Purchase",
  cta_click: "Lead",
  onboarding_step_complete: "CustomizeProduct",
  // Search events (lead search inside CRM + listing search)
  lead_search: "Search",
  listing_searched: "Search",
  // Booking events
  calendly_booking_scheduled: "Schedule",
  calendly_slot_selected: "Schedule",
  // Content views — useful for ViewContent-based audiences
  plan_viewed: "ViewContent",
  lead_opened: "ViewContent",
  pricing_plan_click: "ViewContent",
  // Landing page section_view (especially #solicita-demo) = strong intent
  section_view: "ViewContent",
  // Activation / Subscribe
  whatsapp_connected: "Subscribe",
  // Lead-quality events: a qualified lead becoming active is a strong signal
  lead_qualified: "Lead",
};

const PENDING_PURCHASE_KEY = "proplead_pending_purchase";

type PendingPurchase = {
  plan_id: string;
  value: number;
  currency: string;
  billing_interval: string;
};

function setPendingPurchase(p: PendingPurchase) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(p));
  } catch {
    // sessionStorage may be unavailable (Safari private mode); silently ignore.
  }
}

function consumePendingPurchase(): PendingPurchase | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
    sessionStorage.removeItem(PENDING_PURCHASE_KEY);
    return raw ? (JSON.parse(raw) as PendingPurchase) : null;
  } catch {
    return null;
  }
}

function trackMeta(name: string, params?: Record<string, unknown>) {
  if (!hasFbq()) return;
  const mapped = META_STANDARD_EVENTS[name];
  // For Meta, monetary events should only include value/currency, not the
  // extra GA-specific params (which Meta will ignore but pollute the payload).
  // Pass through the original params object — Meta's pixel filters unknown keys.
  if (mapped) {
    window.fbq!("track", mapped, params);
  } else {
    window.fbq!("trackCustom", name, params);
  }
}

export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export const analytics = {
  // --- Page views ---
  trackPageView(path: string) {
    if (hasGtag()) {
      window.gtag("event", "page_view", {
        page_path: path,
        page_location:
          typeof window !== "undefined" ? window.location.href : undefined,
        page_title:
          typeof document !== "undefined" ? document.title : undefined,
      });
    }
    if (hasFbq()) {
      window.fbq!("track", "PageView");
    }
  },

  // --- Consent ---
  updateConsent(prefs: ConsentPreferences) {
    if (hasGtag()) {
      window.gtag("consent", "update", {
        analytics_storage: prefs.analytics ? "granted" : "denied",
        ad_storage: prefs.marketing ? "granted" : "denied",
        ad_user_data: prefs.marketing ? "granted" : "denied",
        ad_personalization: prefs.marketing ? "granted" : "denied",
      });
    }
    // Meta Pixel: queued events from index.html (PageView) flush on grant.
    if (hasFbq()) {
      window.fbq!("consent", prefs.marketing ? "grant" : "revoke");
    }
  },

  // --- User identity (no PII) ---
  identify(props: {
    user_id: string;
    plan?: string;
    role?: string;
    org_id_hash?: string;
    onboarding_completed?: boolean;
    org_size?: number;
  }) {
    if (!hasGtag()) return;
    const { user_id, ...userProps } = props;
    window.gtag("config", GA_ID, { user_id });
    window.gtag("set", "user_properties", userProps);
  },

  reset() {
    if (!hasGtag()) return;
    window.gtag("config", GA_ID, { user_id: null });
  },

  // --- Auth ---
  trackLogin(method: "email" | "google") {
    trackEvent("login", { method });
  },
  trackSignUp(method: "email" | "google") {
    trackEvent("sign_up", { method });
  },
  trackLogout() {
    trackEvent("logout");
  },

  // --- Payments / Subscription ---
  trackBeginCheckout(params: {
    plan_id: string;
    plan_name: string;
    billing_interval: string;
    value: number;
    currency?: string;
  }) {
    const currency = params.currency ?? "EUR";
    trackEvent("begin_checkout", { ...params, currency });
    // Persist so the Stripe success redirect can fire a Purchase event with
    // value/currency intact. Stripe doesn't echo these back via the success URL.
    setPendingPurchase({
      plan_id: params.plan_id,
      value: params.value,
      currency,
      billing_interval: params.billing_interval,
    });
  },
  trackBillingPortalOpened(plan_id: string) {
    trackEvent("billing_portal_opened", { plan_id });
  },
  trackPaymentSuccess(source: "subscription" | "onboarding") {
    // Hydrate value/currency/plan_id from the pre-checkout snapshot so Meta's
    // Purchase event carries the monetary signal needed for ad optimization.
    const pending = consumePendingPurchase();
    trackEvent("payment_success", {
      source,
      ...(pending
        ? {
            value: pending.value,
            currency: pending.currency,
            plan_id: pending.plan_id,
            billing_interval: pending.billing_interval,
          }
        : {}),
    });
  },
  trackPaymentCancelled(source: "subscription" | "onboarding") {
    consumePendingPurchase();
    trackEvent("payment_cancelled", { source });
  },
  trackBillingToggle(value: "monthly" | "annual") {
    trackEvent("billing_toggle_changed", { value });
  },
  trackSimulatorAdjusted(params: {
    listings: number;
    leads: number;
    recommended_plan: string;
  }) {
    trackEvent("simulator_adjusted", params);
  },
  trackPlanViewed(plan_id: string) {
    trackEvent("plan_viewed", { plan_id });
  },
  trackPlanCompared(plans: string[]) {
    trackEvent("plan_compared", { plans: plans.join(",") });
  },
  trackCheckoutAbandoned(params: { plan_id: string; step?: string }) {
    trackEvent("checkout_abandoned", params);
  },
  trackPlanChanged(from: string, to: string) {
    trackEvent("plan_changed", { from, to });
  },
  trackSubscriptionCanceled(params: { plan_id: string; reason?: string }) {
    trackEvent("subscription_canceled", params);
  },

  // --- Onboarding ---
  trackOnboardingStepComplete(step: number, step_name: string) {
    trackEvent("onboarding_step_complete", { step, step_name });
  },
  trackOnboardingStepStarted(step: number, step_name: string) {
    trackEvent("onboarding_step_started", { step, step_name });
  },
  trackOnboardingStepSkipped(step: number, step_name: string) {
    trackEvent("onboarding_step_skipped", { step, step_name });
  },
  trackOnboardingStepBack(from: number, to: number) {
    trackEvent("onboarding_step_back", { from, to });
  },
  trackOnboardingAbandoned(last_step: number) {
    trackEvent("onboarding_abandoned", { last_step });
  },
  trackOnboardingResumed(resumed_at_step: number) {
    trackEvent("onboarding_resumed", { resumed_at_step });
  },
  trackCalendlyScheduled() {
    trackEvent("calendly_booking_scheduled", { step: 2 });
  },
  trackCalendlySlotSelected(date?: string) {
    trackEvent("calendly_slot_selected", { date });
  },
  trackOnboardingPurchaseInitiated(package_id: string) {
    trackEvent("onboarding_purchase_initiated", { package_id });
  },

  // --- Marketing / CTAs ---
  trackCtaClick(params: {
    location: string;
    label: string;
    source_page?: string;
  }) {
    trackEvent("cta_click", params);
  },
  trackSolicitaDemoClick(location: "hero" | "solucion_cta" | "nav" | "pricing" | "footer") {
    trackEvent("cta_click", {
      label: "solicita_demo",
      location,
      source_page: "marketing_landing_v2",
    });
  },
  trackPricingPlanClick(params: {
    plan_id: string;
    plan_name: string;
    billing_interval: string;
    source_page: string;
  }) {
    trackEvent("pricing_plan_click", params);
  },
  trackFaqToggle(question_index: number, open: boolean) {
    trackEvent("faq_toggle", { question_index, open });
  },
  trackScrollDepth(percent: 25 | 50 | 75 | 100) {
    trackEvent("scroll_depth", { percent });
  },
  trackSectionView(section: string) {
    trackEvent("section_view", { section });
  },
  trackVideoPlay(video_id: string) {
    trackEvent("video_play", { video_id });
  },
  trackVideoComplete(video_id: string) {
    trackEvent("video_complete", { video_id });
  },

  // --- App engagement (general) ---
  trackDateFilterChanged(filter: string) {
    trackEvent("date_filter_changed", { filter });
  },
  trackListingFilterChanged(listing_id: string) {
    trackEvent("listing_filter_changed", { listing_id });
  },
  trackCheckoutIntentResumed(plan_id: string) {
    trackEvent("checkout_intent_resumed", { plan_id });
  },
  trackPackagePurchaseInitiated(package_id: string) {
    trackEvent("package_purchase_initiated", { package_id });
  },

  // --- Leads / CRM ---
  trackLeadListViewed(params: { count: number; filter?: string }) {
    trackEvent("lead_list_viewed", params);
  },
  trackLeadFilterApplied(filter_type: string, value: string) {
    trackEvent("lead_filter_applied", { filter_type, value });
  },
  trackLeadSearch(query_length: number) {
    trackEvent("lead_search", { query_length });
  },
  trackLeadOpened(lead_id_hash: string) {
    trackEvent("lead_opened", { lead_id_hash });
  },
  trackLeadStatusChanged(from: string, to: string) {
    trackEvent("lead_status_changed", { from, to });
  },
  trackLeadQualified(params: { lead_id_hash: string; qualification_score?: number }) {
    trackEvent("lead_qualified", params);
  },
  trackLeadAssigned(to_role: string) {
    trackEvent("lead_assigned", { to_role });
  },
  trackLeadExported(params: { count: number; format: string }) {
    trackEvent("lead_exported", params);
  },
  trackBulkActionExecuted(params: { action: string; count: number }) {
    trackEvent("bulk_action_executed", params);
  },
  trackConsentModalShown() {
    trackEvent("consent_modal_shown");
  },
  trackConsentModalAccepted() {
    trackEvent("consent_modal_accepted");
  },
  trackConsentModalDeclined() {
    trackEvent("consent_modal_declined");
  },

  // --- Conversations / WhatsApp ---
  trackConversationOpened(conversation_id_hash: string) {
    trackEvent("conversation_opened", {
      conversation_id_hash,
      channel: "whatsapp",
    });
  },
  trackMessageSent(params: {
    type: "text" | "template" | "media";
    is_ai?: boolean;
  }) {
    trackEvent("message_sent", params);
  },
  trackTemplateUsed(template_id: string) {
    trackEvent("template_used", { template_id });
  },
  trackAiReplyGenerated() {
    trackEvent("ai_reply_generated");
  },
  trackAiReplyUsed(params: { used: boolean; edited?: boolean }) {
    trackEvent("ai_reply_used", params);
  },
  trackMassCampaignStarted(params: {
    recipient_count: number;
    template_id?: string;
  }) {
    trackEvent("mass_campaign_started", params);
  },
  trackWhatsappConnectStarted(provider: "twilio" | "cloud_api") {
    trackEvent("whatsapp_connect_started", { provider });
  },
  trackWhatsappConnected(provider: "twilio" | "cloud_api") {
    trackEvent("whatsapp_connected", { provider });
  },
  trackWhatsappDisconnected() {
    trackEvent("whatsapp_disconnected");
  },

  // --- Listings ---
  trackListingCreated(source: "manual" | "import" | "ai") {
    trackEvent("listing_created", { source });
  },
  trackListingEdited(field: string) {
    trackEvent("listing_edited", { field });
  },
  trackListingImported(params: { source: string; count: number }) {
    trackEvent("listing_imported", params);
  },
  trackListingPublished() {
    trackEvent("listing_published");
  },
  trackListingSearched(query_length: number) {
    trackEvent("listing_searched", { query_length });
  },
  trackListingDeleted() {
    trackEvent("listing_deleted");
  },
  trackListingAiGenerationStarted() {
    trackEvent("listing_ai_generation_started");
  },
  trackListingAiGenerationCompleted(duration_ms: number) {
    trackEvent("listing_ai_generation_completed", { duration_ms });
  },

  // --- Team / Settings ---
  trackTeamMemberInvited(invitee_role: string) {
    trackEvent("team_member_invited", { invitee_role });
  },
  trackTeamMemberRemoved() {
    trackEvent("team_member_removed");
  },
  trackRoleChanged(from: string, to: string) {
    trackEvent("role_changed", { from, to });
  },
  trackSettingsUpdated(section: string) {
    trackEvent("settings_updated", { section });
  },
  trackIntegrationConnected(integration: string) {
    trackEvent("integration_connected", { integration });
  },
  trackProfileUpdated() {
    trackEvent("profile_updated");
  },

  // --- Errors / performance ---
  trackAppError(params: { error_message_short: string; route?: string }) {
    trackEvent("app_error", params);
  },
  trackApiError(params: { endpoint_short: string; status: number }) {
    trackEvent("api_error", params);
  },
  trackSlowPageLoad(params: { route: string; ms: number }) {
    trackEvent("slow_page_load", params);
  },
  trackNotFoundHit(attempted_path: string) {
    trackEvent("not_found_hit", { attempted_path });
  },
  trackFormValidationError(params: { form_id: string; field: string }) {
    trackEvent("form_validation_error", params);
  },
};

/**
 * Hash an arbitrary ID to a short non-PII string suitable for analytics params.
 * SHA-256, truncated to 8 hex chars. Falls back to a simple sync hash when
 * the crypto API isn't available (very old browsers / non-secure contexts).
 */
export async function hashId(id: string): Promise<string> {
  if (!id) return "";
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(id),
    );
    return Array.from(new Uint8Array(buf).slice(0, 4))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback: simple djb2-style hash.
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33) ^ id.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Synchronous variant for hot paths that don't want to await. Same algorithm
 * as the async fallback. Not cryptographically strong, but adequate to avoid
 * sending raw IDs to GA.
 */
export function hashIdSync(id: string): string {
  if (!id) return "";
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33) ^ id.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}
