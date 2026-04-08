/** Lowercase, strip accents — for matching spoken/transcribed province names. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function composeListingAddress(parts: {
  street?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  country?: string;
}): string {
  const { street, postalCode, city, province, country } = parts;
  const line1 = [street].filter(Boolean).join(" ").trim();
  const line2 = [postalCode, city].filter(Boolean).join(" ").trim();
  const line3 = [province, country].filter(Boolean).join(", ").trim();
  return [line1, line2, line3].filter(Boolean).join(", ");
}
