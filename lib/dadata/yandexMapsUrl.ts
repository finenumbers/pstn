const YANDEX_MAPS_PREFIX = "https://yandex.ru/maps/?text=";

/** Excel and browsers reject very long hrefs. Keep a margin under common limits. */
export const YANDEX_MAPS_URL_MAX_LENGTH = 2000;

/** Yandex search link for a legal address string. Coordinates are not used. */
export function yandexMapsUrl(address: string | null | undefined): string | null {
  const text = address?.trim();
  if (!text) return null;
  const url = `${YANDEX_MAPS_PREFIX}${encodeURIComponent(text)}`;
  if (url.length > YANDEX_MAPS_URL_MAX_LENGTH) return null;
  if (!url.startsWith(YANDEX_MAPS_PREFIX)) return null;
  return url;
}
