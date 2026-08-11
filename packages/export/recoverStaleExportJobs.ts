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

export async function recoverStaleExportJobs(): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_EXPORT_JOB_MS);
  const stale = await db
    .select()
    .from(exportJobs)
    .where(
      and(
        inArray(exportJobs.status, ["pending", "running"]),
        lt(exportJobs.updatedAt, staleBefore)
      )
    );

  for (const job of stale) {
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
      .where(eq(exportJobs.id, job.id));
  }

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

  return stale.length;
}
