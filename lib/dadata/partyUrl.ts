const DADATA_PARTY_BASE = "https://dadata.ru/find/party";

/** Public DaData company card URL for a legal entity or IP INN (10 or 12 digits). */
export function dadataPartyUrl(inn: string): string | null {
  const digits = inn.trim();
  if (!/^\d{10}$/.test(digits) && !/^\d{12}$/.test(digits)) return null;
  return `${DADATA_PARTY_BASE}/${digits}`;
}
