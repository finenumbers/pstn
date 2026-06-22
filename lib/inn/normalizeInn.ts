/** Digits-only INN for matching MinDigital CSV rows with OPR register. */
export function normalizeInn(value: string): string {
  return value.trim().replace(/\D/g, "");
}
