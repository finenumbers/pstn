import {
  EMPTY_PHONE_SLOT,
  formatPhoneMaskForApi,
  isPhoneMaskEmpty,
  normalizePhoneMask,
  serializePhoneMask,
} from "@/lib/phoneNumberMask";

export const LOOKUP_DEFAULT_PHONE = "4996660000";
export const LOOKUP_DEFAULT_MASK = "499X66XXXX";
/** ООО «Фронтир Нетворк» — default INN for curl examples. */
export const LOOKUP_DEFAULT_INN = "5406978329";

export function phoneQueryFromMask(maskValue: string): string | null {
  const slots = normalizePhoneMask(maskValue);
  if (
    slots.length === 10 &&
    slots.every((slot) => slot !== EMPTY_PHONE_SLOT && /\d/.test(slot))
  ) {
    return slots.join("");
  }
  return null;
}

export function maskSearchQueryFromMask(maskValue: string): string {
  if (isPhoneMaskEmpty(maskValue)) {
    return LOOKUP_DEFAULT_MASK;
  }
  const normalized = serializePhoneMask(normalizePhoneMask(maskValue));
  return formatPhoneMaskForApi(normalized);
}

export function buildLookupCurlExample(
  origin: string,
  apiKey: string,
  phone: string = LOOKUP_DEFAULT_PHONE
): string {
  const base = origin.replace(/\/$/, "");
  return `curl -s "${base}/api/v1/lookup?phone=${phone}" -H "Authorization: Bearer ${apiKey}"`;
}

export function buildLookupSearchCurlExample(
  origin: string,
  apiKey: string,
  phoneMask: string = LOOKUP_DEFAULT_MASK,
  page = 1,
  pageSize = 50,
  dataset = "current"
): string {
  const base = origin.replace(/\/$/, "");
  const encodedPhone = encodeURIComponent(phoneMask);
  const datasetQuery = dataset !== "current" ? `&dataset=${encodeURIComponent(dataset)}` : "";
  return `curl -s "${base}/api/v1/lookup/search?phone=${encodedPhone}&page=${page}&pageSize=${pageSize}${datasetQuery}" -H "Authorization: Bearer ${apiKey}"`;
}

export function buildLookupByInnCurlExample(
  origin: string,
  apiKey: string,
  inn: string = LOOKUP_DEFAULT_INN,
  page = 1,
  pageSize = 50,
  dataset = "current"
): string {
  const base = origin.replace(/\/$/, "");
  const encodedInn = encodeURIComponent(inn);
  const datasetQuery = dataset !== "current" ? `&dataset=${encodeURIComponent(dataset)}` : "";
  return `curl -s "${base}/api/v1/lookup/by-inn?inn=${encodedInn}&page=${page}&pageSize=${pageSize}${datasetQuery}" -H "Authorization: Bearer ${apiKey}"`;
}

export function buildLookupCurlExamples(
  origin: string,
  apiKey: string,
  phoneMask = "",
  dataset = "current"
): { exactCurl: string; searchCurl: string; byInnCurl: string } {
  const exactPhone = phoneQueryFromMask(phoneMask);
  const searchMask = maskSearchQueryFromMask(phoneMask);
  return {
    exactCurl: buildLookupCurlExample(
      origin,
      apiKey,
      exactPhone ?? LOOKUP_DEFAULT_PHONE
    ),
    searchCurl: buildLookupSearchCurlExample(
      origin,
      apiKey,
      searchMask,
      1,
      50,
      dataset
    ),
    byInnCurl: buildLookupByInnCurlExample(
      origin,
      apiKey,
      LOOKUP_DEFAULT_INN,
      1,
      50,
      dataset
    ),
  };
}

/** Origin for curl examples: EXTERNAL_API_BASE_URL or incoming request host. */
export function resolveLookupExampleOrigin(
  request: Pick<Request, "headers">,
  configuredBaseUrl?: string
): string {
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return "";

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  return `${proto}://${host}`;
}
