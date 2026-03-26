/**
 * WhatsApp ID and Phone Normalization Utilities
 */

/**
 * Normalizes a chatId to handle both @c.us and @s.whatsapp.net formats.
 * Extracts the phone number part.
 */
export function extractPhoneFromChatId(chatId: string): string {
    return chatId.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
}

/**
 * Returns all possible chatId variants for a given chatId or phone number.
 */
export function getChatIdVariants(chatIdOrPhone: string): string[] {
    const phone = extractPhoneFromChatId(chatIdOrPhone);
    return [
        `${phone}@c.us`,
        `${phone}@s.whatsapp.net`,
    ];
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
