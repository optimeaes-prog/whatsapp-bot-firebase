/**
 * WhatsApp ID and Phone Normalization Utilities
 */

/**
 * Normalizes a chatId to handle both @c.us and @s.whatsapp.net formats.
 * Extracts the phone number part.
 */
export function extractPhoneFromChatId(chatId: string): string {
    return chatId
        .replace(/@(c\.us|s\.whatsapp\.net)$/, "")
        .replace(/^whatsapp:/, "")
        .replace(/^\+/, "");
}

/**
 * Argentine mobile numbers carry an extra "9" after the country code 54 in
 * their international form (+54 9 …), but the same subscriber is frequently
 * stored without it (+54 …, e.g. leads imported from Idealista). WhatsApp may
 * deliver either form, so the two must be treated as the same person —
 * otherwise an inbound from +54 9 … never matches a lead saved as +54 … and
 * gets mis-classified as a non-lead (the bot then stays silent).
 *
 * Returns equivalent phone-digit forms, INPUT FORM FIRST (so callers that pick
 * the first match reply to the number the user actually messaged from). Country
 * code 54 is Argentina-exclusive, so keying on the 54 / 549 prefix is safe.
 */
export function getArgentinaPhoneVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, "");
    const variants = [digits];
    if (digits.startsWith("549") && digits.length >= 12) {
        variants.push("54" + digits.slice(3)); // drop the mobile 9
    } else if (digits.startsWith("54") && digits.length >= 11) {
        variants.push("549" + digits.slice(2)); // add the mobile 9
    }
    return variants;
}

/**
 * Returns all possible chatId variants for a given chatId or phone number.
 * Covers @c.us vs @s.whatsapp.net suffixes AND the Argentine "9" mobile-prefix
 * forms (see getArgentinaPhoneVariants).
 */
export function getChatIdVariants(chatIdOrPhone: string): string[] {
    const phone = extractPhoneFromChatId(chatIdOrPhone);
    const variants: string[] = [];
    for (const p of getArgentinaPhoneVariants(phone)) {
        variants.push(`${p}@c.us`, `${p}@s.whatsapp.net`);
    }
    return variants;
}

/**
 * Normalizes a chatId to the canonical format (@s.whatsapp.net).
 * This ensures all conversations are stored with a consistent ID,
 * preventing duplicates caused by WhatsApp ID variants.
 */
export function normalizeToCanonicalChatId(chatIdOrPhone: string): string {
    const phone = extractPhoneFromChatId(chatIdOrPhone);
    return `${phone}@s.whatsapp.net`;
}

/**
 * Ensures a timestamp is in milliseconds.
 * If it's in seconds (less than 1 trillion), multiplies by 1000.
 */
export function ensureTimestampMillis(timestamp: number): number {
    if (Number.isNaN(timestamp)) return Date.now();
    if (timestamp < 1_000_000_000_000) return timestamp * 1000;
    return timestamp;
}

/**
 * Normalizes digits for country code checking.
 */
export function normalizeDigitsForCountryCheck(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.replace(/^00+/, "");
}

/**
 * Checks if a phone number is likely Spanish.
 */
const SPANISH_LOCAL_NUMBER_REGEX = /^[6789]\d{8}$/;
export function isSpanishPhoneNumber(phone?: string): boolean {
    if (!phone) return true;
    const trimmed = phone.trim();
    if (!trimmed) return true;
    const normalizedDigits = normalizeDigitsForCountryCheck(trimmed);
    if (!normalizedDigits) return true;
    if (normalizedDigits.startsWith("34")) return true;
    if (SPANISH_LOCAL_NUMBER_REGEX.test(normalizedDigits)) return true;
    return false;
}
