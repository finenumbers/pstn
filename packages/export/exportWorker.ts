import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { once } from "node:events";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/packages/db";
import { exportJobs } from "@/packages/db/schema";
import { countRanges } from "@/packages/db/queries/rangesQueries";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import { filtersSchema } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { tryParseDatasetParam } from "@/packages/shared/contracts/dataset.schema";
import { writeRangesXlsxToStream } from "@/lib/export/writeRangesXlsx";
import { EXPORT_JOB_ADVISORY_LOCK_KEY } from "./exportJobConstants";
import { exportFilePath, ensureExportDir } from "./exportPaths";
import { recoverStaleExportJobs } from "./recoverStaleExportJobs";

const cancelControllers = new Map<string, AbortController>();

async function safeUnlink(path: string | null | undefined) {
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}

function serializeDataset(dataset?: DatasetRef): string | null {
  if (!dataset || dataset.kind === "current") return "current";
  return `diff:${dataset.snapshotId}`;
}

export async function startExportJob(input: {
  filters: FiltersDTO;
  dataset?: DatasetRef;
}): Promise<{ jobId: string; status: string; totalRows: number }> {
  await recoverStaleExportJobs();
  ensureExportDir();

  const filtersParsed = filtersSchema.parse(input.filters);
  const totalRows = await countRanges(filtersParsed, input.dataset);

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${EXPORT_JOB_ADVISORY_LOCK_KEY})`
    );

    const active = await tx
      .select()
      .from(exportJobs)
      .where(inArray(exportJobs.status, ["pending", "running"]))
      .orderBy(desc(exportJobs.createdAt))
      .limit(1);

    if (active.length > 0) {
      return {
        jobId: active[0]!.id,
        status: "busy" as const,
        totalRows: active[0]!.totalRows,
        schedule: false as const,
      };
    }

    const [job] = await tx
      .insert(exportJobs)
      .values({
        status: "pending",
        filtersJson: filtersParsed as unknown as Record<string, unknown>,
        dataset: serializeDataset(input.dataset),
        totalRows,
        rowsWritten: 0,
      })
      .returning();

    return {
      jobId: job!.id,
      status: "pending",
      totalRows,
      schedule: true as const,
    };
  });

  if (result.status === "busy") {
    return {
      jobId: result.jobId,
      status: "busy",
      totalRows: result.totalRows,
    };
  }

  if (result.schedule) {
    setImmediate(() => {
      runExportJob(result.jobId).catch((err) => {
        console.error("Export job failed:", err);
      });
    });
  }

  return {
    jobId: result.jobId,
    status: result.status,
    totalRows: result.totalRows,
  };
}

export async function getExportJobStatus(jobId: string) {
  const [job] = await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.id, jobId))
    .limit(1);
  return job ?? null;
}

export async function cancelExportJob(jobId: string): Promise<boolean> {
  const controller = cancelControllers.get(jobId);
  if (controller) {
    controller.abort();
  }

  const [job] = await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.id, jobId))
    .limit(1);
  if (!job) return false;
  if (job.status === "completed" || job.status === "failed") return false;

  await safeUnlink(job.filePath);
  await db
    .update(exportJobs)
    .set({
      status: "cancelled",
      errorMessage: "Export cancelled",
      finishedAt: new Date(),
      updatedAt: new Date(),
      filePath: null,
    })
    .where(
      and(
        eq(exportJobs.id, jobId),
        inArray(exportJobs.status, ["pending", "running"])
      )
    );
  return true;
}

async function runExportJob(jobId: string) {
  const controller = new AbortController();
  cancelControllers.set(jobId, controller);

  const [job] = await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.id, jobId))
    .limit(1);
  if (!job) {
    cancelControllers.delete(jobId);
    return;
  }

  const filePath = exportFilePath(jobId);
  let lastProgressAt = 0;

  try {
    await db
      .update(exportJobs)
      .set({
        status: "running",
        startedAt: new Date(),
        updatedAt: new Date(),
        filePath,
      })
      .where(eq(exportJobs.id, jobId));

    const filters = filtersSchema.parse(job.filtersJson);
    const parsedDataset = tryParseDatasetParam(job.dataset ?? "current");
    if (!parsedDataset.success) {
      throw new Error("Invalid dataset on export job");
    }

    const stream = createWriteStream(filePath);
    const finishPromise = once(stream, "finish");
    const { rowsWritten, durationMs } = await writeRangesXlsxToStream({
      filters,
      totalRows: job.totalRows,
      dataset: parsedDataset.data,
      signal: controller.signal,
      stream,
      onProgress: async (written) => {
        const now = Date.now();
        if (now - lastProgressAt < 500 && written < job.totalRows) return;
        lastProgressAt = now;
        await db
          .update(exportJobs)
          .set({ rowsWritten: written, updatedAt: new Date() })
          .where(eq(exportJobs.id, jobId));
      },
    });
    await finishPromise.catch(() => undefined);

    if (controller.signal.aborted) {
      await safeUnlink(filePath);
      return;
    }

    await db
      .update(exportJobs)
      .set({
        status: "completed",
        rowsWritten,
        finishedAt: new Date(),
        updatedAt: new Date(),
        filePath,
      })
      .where(eq(exportJobs.id, jobId));

    console.warn(
      JSON.stringify({
        msg: "export_job_completed",
        jobId,
        rowsWritten,
        durationMs,
      })
    );
  } catch (error) {
    if (controller.signal.aborted) {
      await safeUnlink(filePath);
      cancelControllers.delete(jobId);
      return;
    }
    const message =
      error instanceof Error ? error.message : "Export failed";
    await safeUnlink(filePath);
    await db
      .update(exportJobs)
      .set({
        status: "failed",
        errorMessage: message,
        finishedAt: new Date(),
        updatedAt: new Date(),
        filePath: null,
      })
      .where(eq(exportJobs.id, jobId));
    console.error("Export job error:", jobId, error);
  } finally {
    cancelControllers.delete(jobId);
  }
}
