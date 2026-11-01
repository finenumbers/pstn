import https from "node:https";
import {
  parsePartyAddress,
  type ParsedPartyAddress,
} from "@/lib/dadata/parsePartyAddress";

const FIND_PARTY_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";

export const PARTY_REQUEST_TIMEOUT_MS = 10_000;

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 2,
});

export type EnrichStopReason =
  | "missing_key"
  | "unauthorized"
  | "daily_limit"
  | "timeout";

export class PartyHttpError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly stop?: EnrichStopReason
  ) {
    super(message);
    this.name = "PartyHttpError";
  }
}

export function readDadataApiKey(): string | null {
  const key = process.env.DADATA_API_KEY?.trim();
  return key ? key : null;
}

function classifyStatus(status: number): PartyHttpError | null {
  if (status === 200) return null;
  if (status === 401) {
    return new PartyHttpError("401", false, "unauthorized");
  }
  if (status === 403) {
    return new PartyHttpError("403", false, "daily_limit");
  }
  if (status === 429 || status >= 500 || status === 0) {
    return new PartyHttpError(String(status), true);
  }
  return new PartyHttpError(String(status), false);
}

function requestParty(
  inn: string,
  apiKey: string
): Promise<{ status: number; body: unknown }> {
  const payload = JSON.stringify({
    query: inn,
    branch_type: "MAIN",
    count: 1,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      FIND_PARTY_URL,
      {
        method: "POST",
        agent,
        timeout: PARTY_REQUEST_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (!text) {
            resolve({ status: res.statusCode ?? 0, body: null });
            return;
          }
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(text) as unknown,
            });
          } catch {
            reject(new PartyHttpError("invalid json", true));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new PartyHttpError("timeout", true));
    });
    req.on("error", (error) => {
      if (error instanceof PartyHttpError) {
        reject(error);
        return;
      }
      reject(new PartyHttpError(error.message, true));
    });
    req.write(payload);
    req.end();
  });
}

/** One findById/party call. Does not log the key or the response body. */
export async function findPartyAddress(
  inn: string,
  apiKey: string
): Promise<ParsedPartyAddress> {
  const response = await requestParty(inn, apiKey);
  const failure = classifyStatus(response.status);
  if (failure) {
    if (!failure.retryable) {
      console.info(`enrich legal address inn=${inn} status=${response.status}`);
    }
    throw failure;
  }
  return parsePartyAddress(response.body);
}
