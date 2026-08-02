import { defineSecret } from "firebase-functions/params";

/**
 * HMAC secret for the signed links to the public "leads sin respuesta" page
 * (set in Secret Manager). Kept separate from EMAIL_UNSUBSCRIBE_SECRET so a
 * leak of one link-signing key can't be used to mint the other kind of link.
 */
export const INACTIVE_LEADS_SECRET = defineSecret("INACTIVE_LEADS_SECRET");
