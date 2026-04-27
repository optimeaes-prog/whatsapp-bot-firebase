import { defineSecret } from "firebase-functions/params";

// Centralised Secret Manager params (Firebase Functions v2).
// Any function that reads one of these MUST declare it in its onRequest/onCall `secrets: [...]` option.

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const WHAPI_TOKEN = defineSecret("WHAPI_TOKEN");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
export const VAPI_API_KEY = defineSecret("VAPI_API_KEY");
export const ELEVENLABS_KEY = defineSecret("11LABS_KEY");
export const MAKE_WEBHOOK_SHARED_SECRET = defineSecret("MAKE_WEBHOOK_SHARED_SECRET");

export const CALENDLY_WEBHOOK_SIGNING_KEY = defineSecret("CALENDLY_WEBHOOK_SIGNING_KEY");
export const CALENDLY_PAT = defineSecret("CALENDLY_PAT");

export const ADMIN_TEMPLATE_TOKEN = defineSecret("ADMIN_TEMPLATE_TOKEN");
export const STRIPE_PRICE_TOPUP_40_CONVS = defineSecret("STRIPE_PRICE_TOPUP_40_CONVS");
export const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// Meta / WhatsApp Embedded Signup.
// META_APP_ID and META_FB_LOGIN_CONFIG_ID are not strictly "secret" (the App ID is
// visible in the frontend), but keeping all three in Secret Manager avoids a
// second config mechanism and lets us rotate config_ids without redeploying code.
export const META_APP_ID = defineSecret("META_APP_ID");
export const META_APP_SECRET = defineSecret("META_APP_SECRET");
export const META_FB_LOGIN_CONFIG_ID = defineSecret("META_FB_LOGIN_CONFIG_ID");
// Global webhook verify token — value you configure on Meta's Webhooks setup page.
// Used for the GET handshake on `whatsappWebhook` (app-wide, not per-org).
export const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");
