import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { db } from "@/packages/db";
import { exportJobs } from "@/packages/db/schema";
import {
  EXPORT_FILE_TTL_MS,
  STALE_EXPORT_ERROR,
  STALE_EXPORT_JOB_MS,
} from "./exportJobConstants";

async function safeUnlink(path: string | null | undefined) {
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // ignore missing files
  }
}

async function failInFlightExportJobs(olderThan?: Date): Promise<number> {
  const inFlight = inArray(exportJobs.status, ["pending", "running"]);
  const jobs = await db
    .select()
    .from(exportJobs)
    .where(olderThan ? and(inFlight, lt(exportJobs.updatedAt, olderThan)) : inFlight);

  for (const job of jobs) {
    await safeUnlink(job.filePath);
    await db
      .update(exportJobs)
      .set({
        status: "failed",
        errorMessage: STALE_EXPORT_ERROR,
        finishedAt: new Date(),
        updatedAt: new Date(),
        filePath: null,
      })
      .where(
        and(
          eq(exportJobs.id, job.id),
          inArray(exportJobs.status, ["pending", "running"])
        )
      );
  }

  return jobs.length;
}

async function expireExportFiles(): Promise<void> {
  const ttlBefore = new Date(Date.now() - EXPORT_FILE_TTL_MS);
  const expired = await db
    .select()
    .from(exportJobs)
    .where(
      and(
        inArray(exportJobs.status, ["completed", "failed", "cancelled"]),
        or(
          lt(exportJobs.finishedAt, ttlBefore),
          and(
            sql`${exportJobs.finishedAt} is null`,
            lt(exportJobs.updatedAt, ttlBefore)
          )
        )
      )
    );

  for (const job of expired) {
    await safeUnlink(job.filePath);
    if (job.filePath) {
      await db
        .update(exportJobs)
        .set({ filePath: null, updatedAt: new Date() })
        .where(eq(exportJobs.id, job.id));
    }
  }

}

/** Drop export files past TTL, and fail jobs whose heartbeat stopped. */
export async function recoverStaleExportJobs(): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_EXPORT_JOB_MS);
  const failed = await failInFlightExportJobs(staleBefore);
  await expireExportFiles();
  return failed;
}

/**
 * This process is the only export writer. Anything still pending or running
 * at startup belongs to a previous process and must not block the next export.
 */
export async function failOrphanedExportJobs(): Promise<number> {
  const failed = await failInFlightExportJobs();
  await expireExportFiles();
  return failed;
}
