import { and, inArray, lt } from "drizzle-orm";
import { db, importPool } from "@/packages/db";
import { importJobs } from "@/packages/db/schema";
import { RANGES_STAGING_TABLE } from "@/packages/db/importTables";
import { dropImportDiffOldTable } from "@/packages/import/diffSnapshot";
import {
  STALE_IMPORT_JOB_MESSAGE,
  STALE_IMPORT_JOB_MS,
} from "./importJobConstants";

export { STALE_IMPORT_JOB_MESSAGE } from "./importJobConstants";

export async function recoverStaleImportJobs(): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_IMPORT_JOB_MS);

  const stale = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(
      and(
        inArray(importJobs.status, ["pending", "running"]),
        lt(importJobs.updatedAt, staleBefore)
      )
    );

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
    .where(
      and(
        inArray(importJobs.status, ["pending", "running"]),
        lt(importJobs.updatedAt, staleBefore)
      )
    );

  await importPool().query(`TRUNCATE TABLE ${RANGES_STAGING_TABLE} RESTART IDENTITY`);
  await dropImportDiffOldTable().catch(() => undefined);

  return stale.length;
}
