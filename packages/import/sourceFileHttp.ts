import { USER_AGENT } from "./constants";

export function getDownloadStream(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(300000),
  });
}
