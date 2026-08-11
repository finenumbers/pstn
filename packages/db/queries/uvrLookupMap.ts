import { db } from "../index";
import { operatorsRegister } from "../schema";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Load digit-normalized INN → UVR id_src for export (avoids per-batch JOIN). */
export async function loadUvrLookupMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      inn: operatorsRegister.inn,
      idSrc: operatorsRegister.idSrc,
    })
    .from(operatorsRegister);

  const map = new Map<string, number>();
  for (const row of rows) {
    const digits = digitsOnly(row.inn ?? "");
    if (!digits) continue;
    map.set(digits, row.idSrc);
  }
  return map;
}

export function lookupUvrAntifraud(
  map: Map<string, number>,
  inn: string | null | undefined
): number | null {
  if (!inn) return null;
  const digits = digitsOnly(inn);
  if (!digits) return null;
  return map.get(digits) ?? null;
}
