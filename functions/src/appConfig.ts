import { defineString } from "firebase-functions/params";

/**
 * Public app base URL used in emails (no trailing slash).
 * Example: https://proplead.io
 */
export const APP_BASE_URL = defineString("APP_BASE_URL", { default: "https://proplead.io" });

/** Brand shown in outbound emails. */
export const EMAIL_FROM_NAME = defineString("EMAIL_FROM_NAME", { default: "Proplead" });

/** From email address used by the Twilio Email API. */
export const EMAIL_FROM_ADDRESS = defineString("EMAIL_FROM_ADDRESS", { default: "noreply@proplead.io" });

/** Logo URL (absolute) embedded in transactional emails. */
export const EMAIL_LOGO_URL = defineString("EMAIL_LOGO_URL", {
  default: "https://proplead.io/proplead-high-resolution-logo.png",
});
