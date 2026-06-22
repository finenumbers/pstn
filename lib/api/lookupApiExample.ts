import {
  EMPTY_PHONE_SLOT,
  formatPhoneMaskForApi,
  isPhoneMaskEmpty,
  normalizePhoneMask,
  serializePhoneMask,
} from "@/lib/phoneNumberMask";

export const LOOKUP_DEFAULT_PHONE = "4996660000";
export const LOOKUP_DEFAULT_MASK = "499X66XXXX";

export function phoneQueryFromMask(maskValue: string): string {
  const slots = normalizePhoneMask(maskValue);
  if (
    slots.length === 10 &&
    slots.every((slot) => slot !== EMPTY_PHONE_SLOT && /\d/.test(slot))
  ) {
    return slots.join("");
  }
  return LOOKUP_DEFAULT_PHONE;
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
  pageSize = 50
): string {
  const base = origin.replace(/\/$/, "");
  const encodedPhone = encodeURIComponent(phoneMask);
  return `curl -s "${base}/api/v1/lookup/search?phone=${encodedPhone}&page=${page}&pageSize=${pageSize}" -H "Authorization: Bearer ${apiKey}"`;
}

export function buildLookupCurlExamples(
  origin: string,
  apiKey: string,
  phoneMask = ""
): { exactCurl: string; searchCurl: string } {
  const exactPhone = phoneQueryFromMask(phoneMask);
  const searchMask = maskSearchQueryFromMask(phoneMask);
  return {
    exactCurl: buildLookupCurlExample(origin, apiKey, exactPhone),
    searchCurl: buildLookupSearchCurlExample(origin, apiKey, searchMask),
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
