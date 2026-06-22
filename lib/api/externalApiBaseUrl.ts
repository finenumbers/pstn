/** Public base URL for external API curl examples (domain or IP). */
export function getExternalApiBaseUrl(): string | undefined {
  const url = process.env.EXTERNAL_API_BASE_URL?.trim();
  if (!url) return undefined;
  return url.replace(/\/$/, "");
}
