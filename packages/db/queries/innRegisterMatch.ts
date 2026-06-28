import { sql, type SQL } from "drizzle-orm";
import { numberRanges, operatorsRegister } from "../schema";
import type { RangeFilterTable } from "./rangeFilterTable";

export function innRegisterMatchSql(
  innColumn: RangeFilterTable["inn"] = numberRanges.inn
): SQL {
  const rangeInnDigits = sql<string>`regexp_replace(${innColumn}, '\\D', '', 'g')`;
  const registerInnDigits = sql<string>`regexp_replace(${operatorsRegister.inn}, '\\D', '', 'g')`;
  return sql`${rangeInnDigits} = ${registerInnDigits} AND ${rangeInnDigits} <> ''`;
}
