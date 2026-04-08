import { defineSecret } from "firebase-functions/params";

// Centralised Secret Manager params (Firebase Functions v2).
// Any function that reads one of these MUST declare it in its onRequest/onCall `secrets: [...]` option.

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const WHAPI_TOKEN = defineSecret("WHAPI_TOKEN");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
export const VAPI_API_KEY = defineSecret("VAPI_API_KEY");

export const CALENDLY_WEBHOOK_SIGNING_KEY = defineSecret("CALENDLY_WEBHOOK_SIGNING_KEY");
export const CALENDLY_PAT = defineSecret("CALENDLY_PAT");

export const ADMIN_TEMPLATE_TOKEN = defineSecret("ADMIN_TEMPLATE_TOKEN");
