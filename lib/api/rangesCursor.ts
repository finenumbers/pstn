import type {
  NumberRangeRow,
  RangesCursor,
} from "@/packages/shared/contracts/filters.schema";

export function rowToRangesCursor(row: NumberRangeRow): RangesCursor {
  return {
    id: row.id,
    abc: row.abc,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    capacity: row.capacity,
    operator: row.operator,
    settlement: row.settlement,
    region: row.region,
    inn: row.inn,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeRangesCursor(row: NumberRangeRow): string {
  const json = JSON.stringify(rowToRangesCursor(row));
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeRangesCursor(encoded: string): RangesCursor | null {
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encoded))
    ) as RangesCursor;
    if (typeof parsed.id !== "number" || typeof parsed.abc !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
