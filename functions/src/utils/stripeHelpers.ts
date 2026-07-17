export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function extractStripeId(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  return typeof rec.id === "string" ? rec.id : "";
}
