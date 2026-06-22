import { count, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { numberRanges, operatorsRegister } from "../schema";

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
    .innerJoin(operatorsRegister, eq(numberRanges.inn, operatorsRegister.inn))
    .where(sql`${numberRanges.inn} <> ''`);

  return {
    registryOperators: Number(registryRow?.total ?? 0),
    matchedDistinctInns: Number(matchedRow?.matchedDistinctInns ?? 0),
  };
}
