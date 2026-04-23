// Extend the Window interface so TypeScript knows about gtag
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

let isAnalyticsInitialized = false;

export function initializeAnalytics() {
  if (typeof window === "undefined" || isAnalyticsInitialized) return;

  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer.push(args));
  window.gtag("js", new Date());
  // send_page_view: false — SPA page views are fired manually via usePageTracking
  window.gtag("config", id, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  isAnalyticsInitialized = true;
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

export const analytics = {
  trackPageView(path: string) {
    const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
    if (!id || typeof window.gtag !== "function") return;
    window.gtag("config", id, { page_path: path, send_page_view: true });
  },

  // Auth
  trackLogin(method: "email" | "google") {
    trackEvent("login", { method });
  },
  trackSignUp(method: "email" | "google") {
    trackEvent("sign_up", { method });
  },
  trackLogout() {
    trackEvent("logout");
  },

  // Payments
  trackBeginCheckout(params: {
    plan_id: string;
    plan_name: string;
    billing_interval: string;
    value: number;
    currency?: string;
  }) {
    trackEvent("begin_checkout", { currency: "EUR", ...params });
  },
  trackBillingPortalOpened(plan_id: string) {
    trackEvent("billing_portal_opened", { plan_id });
  },
  trackPaymentSuccess(source: "subscription" | "onboarding") {
    trackEvent("payment_success", { source });
  },
  trackPaymentCancelled(source: "subscription" | "onboarding") {
    trackEvent("payment_cancelled", { source });
  },

  // Subscription page interactions
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

  // Onboarding
  trackOnboardingStepComplete(step: number, step_name: string) {
    trackEvent("onboarding_step_complete", { step, step_name });
  },
  trackCalendlyScheduled() {
    trackEvent("calendly_booking_scheduled", { step: 2 });
  },
  trackOnboardingPurchaseInitiated(package_id: string) {
    trackEvent("onboarding_purchase_initiated", { package_id });
  },

  // Marketing / CTAs
  trackCtaClick(params: {
    location: string;
    label: string;
    source_page?: string;
  }) {
    trackEvent("cta_click", params);
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

  // App engagement
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
};
