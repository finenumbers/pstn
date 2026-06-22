import { sql, type SQL } from "drizzle-orm";
import { numberRanges, operatorsRegister } from "../schema";

const rangeInnDigits = sql<string>`regexp_replace(${numberRanges.inn}, '\\D', '', 'g')`;
const registerInnDigits = sql<string>`regexp_replace(${operatorsRegister.inn}, '\\D', '', 'g')`;

/** Join / filter condition: number_ranges.inn matches operators_register.inn (digits only). */
export function innRegisterMatchSql(): SQL {
  return sql`${rangeInnDigits} = ${registerInnDigits} AND ${rangeInnDigits} <> ''`;
}
