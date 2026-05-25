import { defineSecret } from "firebase-functions/params";

/** HMAC secret for signed email preference / unsubscribe links (set in Secret Manager). */
export const EMAIL_UNSUBSCRIBE_SECRET = defineSecret("EMAIL_UNSUBSCRIBE_SECRET");
