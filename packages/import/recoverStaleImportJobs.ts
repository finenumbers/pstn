import { inArray } from "drizzle-orm";
import { db, importPool } from "@/packages/db";
import { importJobs } from "@/packages/db/schema";
import { RANGES_STAGING_TABLE } from "@/packages/db/importTables";

export const STALE_IMPORT_JOB_MESSAGE =
  "Import interrupted by server restart";

export async function recoverStaleImportJobs(): Promise<number> {
  const stale = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(inArray(importJobs.status, ["pending", "running"]));

  if (stale.length === 0) {
    return 0;
  }

  await db
    .update(importJobs)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: STALE_IMPORT_JOB_MESSAGE,
      progressPhase: "failed",
    })
    .where(inArray(importJobs.status, ["pending", "running"]));

  await importPool().query(`TRUNCATE TABLE ${RANGES_STAGING_TABLE} RESTART IDENTITY`);

  return stale.length;
}

export async function stagingTableExists(): Promise<boolean> {
  const result = await importPool().query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
  `,
    [RANGES_STAGING_TABLE]
  );
  return result.rows[0]?.exists ?? false;
}

export async function truncateStagingIfExists(): Promise<void> {
  if (!(await stagingTableExists())) return;
  await importPool().query(`TRUNCATE TABLE ${RANGES_STAGING_TABLE} RESTART IDENTITY`);
}
