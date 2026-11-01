import { db } from "../index";
import { partyAddresses } from "../schema";

/** Load INN → legal address for export. Empty and missing rows are omitted. */
export async function loadLegalAddressMap(): Promise<Map<string, string>> {
  const rows = await db
    .select({
      inn: partyAddresses.inn,
      legalAddress: partyAddresses.legalAddress,
    })
    .from(partyAddresses);

  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.legalAddress) continue;
    map.set(row.inn, row.legalAddress);
  }
  return map;
}

export function lookupLegalAddress(
  map: Map<string, string>,
  inn: string | null | undefined
): string | null {
  if (!inn) return null;
  return map.get(inn) ?? null;
}
