import { defineSecret } from "firebase-functions/params";

// Centralised Secret Manager params (Firebase Functions v2).
// Any function that reads one of these MUST declare it in its onRequest/onCall `secrets: [...]` option.

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
// Master Twilio account SID. Paired with TWILIO_AUTH_TOKEN to create per-org
// subaccounts during WhatsApp Embedded Signup (Tech Provider flow).
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
// Twilio Partner Solution ID granted by Twilio after Meta App approval.
// Exposed to the frontend via getEmbeddedSignupConfig so FB.login passes it as
// `extras.setup.solutionID`, causing Meta to auto-share the customer's WABA
// with Twilio's Partner Solution.
export const TWILIO_PARTNER_SOLUTION_ID = defineSecret("TWILIO_PARTNER_SOLUTION_ID");
// Org ID whose WhatsApp Content templates are the "golden source" cloned into
// every new org's Twilio subaccount at the end of embedded signup. Currently
// "org_paco_granados". Kept in Secret Manager so we can change it without
// redeploying code if the template authoring org changes.
export const PROPLEAD_TEMPLATE_SOURCE_ORG = defineSecret("PROPLEAD_TEMPLATE_SOURCE_ORG");
// Twilio Verify Service SID (master account, cross-tenant). The Service itself
// lives in the Twilio console (Verify → Services) with SMS as primary channel
// and friendly_name "Proplead Notifications". The Service SID is stable —
// stored in Secret Manager so we can rotate the underlying service without
// redeploying (current: VA97f3685ea340323d833e9f8c06d6657d).
export const TWILIO_VERIFY_SERVICE_SID = defineSecret("TWILIO_VERIFY_SERVICE_SID");
export const VAPI_API_KEY = defineSecret("VAPI_API_KEY");
export const ELEVENLABS_KEY = defineSecret("11LABS_KEY");
export const MAKE_WEBHOOK_SHARED_SECRET = defineSecret("MAKE_WEBHOOK_SHARED_SECRET");

export const CALENDLY_WEBHOOK_SIGNING_KEY = defineSecret("CALENDLY_WEBHOOK_SIGNING_KEY");
export const CALENDLY_PAT = defineSecret("CALENDLY_PAT");

export const ADMIN_TEMPLATE_TOKEN = defineSecret("ADMIN_TEMPLATE_TOKEN");
export const STRIPE_PRICE_TOPUP_40_CONVS = defineSecret("STRIPE_PRICE_TOPUP_40_CONVS");
export const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// Twilio Email API credentials (POST https://comms.twilio.com/v1/Emails).
// These are a SendGrid-issued API Key SID + Secret created in Twilio Console
// → Account → API keys & tokens. NOT the same as TWILIO_AUTH_TOKEN /
// TWILIO_ACCOUNT_SID above, which are master-account creds used by the
// messaging subaccount flow. Sender must be authenticated for proplead.io.
export const TWILIO_API_KEY = defineSecret("TWILIO_API_KEY");
export const TWILIO_API_SECRET = defineSecret("TWILIO_API_SECRET");

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
