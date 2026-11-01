export type ParsedPartyAddress =
  | { kind: "ok"; address: string }
  | { kind: "not_found" }
  | { kind: "no_address" };

export function collapseAddress(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function readUnrestrictedAddress(body: unknown): string | null | undefined {
  if (!body || typeof body !== "object") return undefined;
  const suggestions = (body as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return undefined;
  const first = suggestions[0];
  if (!first || typeof first !== "object") return undefined;
  const data = (first as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const address = (data as { address?: unknown }).address;
  if (!address || typeof address !== "object") return null;
  const unrestricted = (address as { unrestricted_value?: unknown })
    .unrestricted_value;
  if (unrestricted == null) return null;
  return typeof unrestricted === "string" ? unrestricted : null;
}

/** Map a findById/party JSON body to the value stored for one INN. */
export function parsePartyAddress(body: unknown): ParsedPartyAddress {
  if (!body || typeof body !== "object") return { kind: "not_found" };
  const suggestions = (body as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return { kind: "not_found" };
  }
  const raw = readUnrestrictedAddress(body);
  if (!raw) return { kind: "no_address" };
  const address = collapseAddress(raw);
  if (!address) return { kind: "no_address" };
  return { kind: "ok", address };
}
