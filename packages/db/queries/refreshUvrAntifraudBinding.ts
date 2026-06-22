import { count, sql } from "drizzle-orm";
import { db } from "../index";
import { numberRanges, operatorsRegister } from "../schema";
import { innRegisterMatchSql } from "./innRegisterMatch";

const UVR_BINDING_CACHE_MS = 60_000;

let uvrBindingCache: {
  value: { registryOperators: number; matchedDistinctInns: number };
  at: number;
} | null = null;

export function invalidateUvrAntifraudBindingCache(): void {
  uvrBindingCache = null;
}

/** Ensures OPR registry is reachable and counts INN matches after production swap. */
export async function refreshUvrAntifraudBinding(): Promise<{
  registryOperators: number;
  matchedDistinctInns: number;
}> {
  const [registryRow] = await db
    .select({ total: count() })
    .from(operatorsRegister);

  const [matchedRow] = await db
    .select({
      matchedDistinctInns: sql<number>`COUNT(DISTINCT ${numberRanges.inn})`.mapWith(
        Number
      ),
    })
    .from(numberRanges)
    .innerJoin(operatorsRegister, innRegisterMatchSql())
    .where(sql`${numberRanges.inn} <> ''`);

  return {
    registryOperators: Number(registryRow?.total ?? 0),
    matchedDistinctInns: Number(matchedRow?.matchedDistinctInns ?? 0),
  };
}

/** Cached UVR binding stats for summary KPI (refreshed after import). */
export async function getUvrAntifraudBindingCached(): Promise<{
  registryOperators: number;
  matchedDistinctInns: number;
}> {
  if (
    uvrBindingCache &&
    Date.now() - uvrBindingCache.at < UVR_BINDING_CACHE_MS
  ) {
    return uvrBindingCache.value;
  }

  const value = await refreshUvrAntifraudBinding();
  uvrBindingCache = { value, at: Date.now() };
  return value;
}
