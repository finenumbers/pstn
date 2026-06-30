import { desc, eq, inArray, sql, and } from "drizzle-orm";
import { db, importPool } from "@/packages/db";
import { RANGES_STAGING_TABLE } from "@/packages/db/importTables";
import { datasetMeta, importJobs } from "@/packages/db/schema";
import { refreshAbcRangeGaps } from "@/packages/db/queries/refreshAbcRangeGaps";
import {
  invalidateUvrAntifraudBindingCache,
  refreshUvrAntifraudBinding,
} from "@/packages/db/queries/refreshUvrAntifraudBinding";
import { ensureOprRegisterLoaded } from "@/packages/import/importOprRegister";
import { clearSummaryCache } from "@/lib/cache/summaryCache";
import { buildImportProgressDisplay } from "@/lib/import/importProgressView";
import {
  BATCH_SIZE,
  emptyLoadedRowsBySource,
  SOURCE_FILES,
  type LoadedRowsBySource,
} from "./constants";
import {
  analyzeRanges,
  clearStaging,
  insertBatch,
  refreshDatasetGlobalStats,
  swapStagingToProduction,
} from "./csvLoader";
import {
  CsvParseIncompleteError,
  parseCsvStream,
} from "./csvParser";
import {
  dropImportDiffOldTable,
  getStoredSourceHashes,
  loadImportDiffOldRanges,
  loadStagingRangesForDiff,
  mskLoadDateKey,
  prepareImportDiffOldTable,
  saveDatasetMetaAfterImport,
} from "./diffSnapshot";
import { saveVersionSnapshot } from "./versionSnapshot";
import {
  countDiffSegments,
  diffRangeDatasets,
} from "./rangeDatasetDiff";
import { recoverStaleImportJobs } from "./recoverStaleImportJobs";
import {
  assertStagingImportComplete,
  ImportValidationError,
} from "./validateStagingImport";
import { getDownloadStream } from "./sourceFileHttp";
import {
  hashAllSourceFiles,
  sourceHashesEqual,
  type SourceFileHashes,
} from "./sourceFileHash";

const IMPORT_JOB_ADVISORY_LOCK_KEY = 7123456789;

export type ImportTriggeredBy = "manual" | "cron";

async function touchImportJobHeartbeat(jobId: string): Promise<boolean> {
  const rows = await db
    .update(importJobs)
    .set({ updatedAt: new Date() })
    .where(and(eq(importJobs.id, jobId), eq(importJobs.status, "running")))
    .returning({ id: importJobs.id });
  return rows.length > 0;
}

async function assertImportJobStillRunning(jobId: string): Promise<void> {
  const stillRunning = await touchImportJobHeartbeat(jobId);
  if (!stillRunning) {
    throw new Error("Import job was interrupted (stale recovery)");
  }
}

function normalizeFileRows(
  value: Record<string, number> | null | undefined
): Partial<LoadedRowsBySource> {
  if (!value) return {};
  return value as Partial<LoadedRowsBySource>;
}

export async function startImportJob(
  triggeredBy: ImportTriggeredBy = "manual"
): Promise<{
  jobId: string;
  status: string;
}> {
  await recoverStaleImportJobs();

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${IMPORT_JOB_ADVISORY_LOCK_KEY})`
    );

    const active = await tx
      .select()
      .from(importJobs)
      .where(inArray(importJobs.status, ["pending", "running"]))
      .orderBy(desc(importJobs.createdAt))
      .limit(1);

    if (active.length > 0) {
      return {
        jobId: active[0].id,
        status: active[0].status,
        schedule: false,
      };
    }

    const [job] = await tx
      .insert(importJobs)
      .values({ status: "pending", triggeredBy, fileRows: {} })
      .returning();

    return { jobId: job.id, status: "pending", schedule: true };
  });

  if (result.schedule) {
    const jobId = result.jobId;
    setImmediate(() => {
      runImportJob(jobId).catch((err) => {
        console.error("Import job failed:", err);
      });
    });
  }

  return { jobId: result.jobId, status: result.status };
}

async function loadSourceFile(
  jobId: string,
  file: (typeof SOURCE_FILES)[number],
  rowsBefore: number
): Promise<number> {
  await db
    .update(importJobs)
    .set({ progressPhase: `loading_${file.key}` })
    .where(eq(importJobs.id, jobId));

  const response = await getDownloadStream(file.url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${file.url}`);
  }

  let fileRowsLoaded = 0;

  const parseResult = await parseCsvStream(
    response.body,
    async (batch) => {
      await insertBatch(batch, file.key);
      fileRowsLoaded += batch.length;

      await importPool().query(
        `
        UPDATE import_jobs
        SET
          rows_loaded = $2,
          progress_phase = $3,
          updated_at = now()
        WHERE id = $1
      `,
        [jobId, rowsBefore + fileRowsLoaded, `loading_${file.key}`]
      );
    },
    BATCH_SIZE
  );

  if (parseResult.loaded === 0) {
    throw new Error(`Source file ${file.key} returned 0 rows`);
  }

  if (parseResult.skipped > 0) {
    throw new CsvParseIncompleteError(
      `${file.key}: skipped ${parseResult.skipped} of ${parseResult.dataLines} CSV data rows`,
      parseResult.skipped,
      parseResult.dataLines
    );
  }

  if (parseResult.loaded !== parseResult.dataLines) {
    throw new CsvParseIncompleteError(
      `${file.key}: loaded ${parseResult.loaded} of ${parseResult.dataLines} CSV data rows`,
      parseResult.dataLines - parseResult.loaded,
      parseResult.dataLines
    );
  }

  return parseResult.loaded;
}

async function failImportJob(
  jobId: string,
  message: string,
  fileRows: Partial<LoadedRowsBySource>
): Promise<void> {
  await db
    .update(importJobs)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: message,
      progressPhase: "failed",
      fileRows,
    })
    .where(eq(importJobs.id, jobId));

  await clearStaging().catch(() => undefined);
  await dropImportDiffOldTable().catch(() => undefined);
}

async function runImportJob(jobId: string): Promise<void> {
  const loadedByFile: LoadedRowsBySource = emptyLoadedRowsBySource();
  let sourceHashes: SourceFileHashes | null = null;

  try {
    await db
      .update(importJobs)
      .set({
        status: "running",
        startedAt: new Date(),
        progressPhase: "checking_sources",
        filesProcessed: 0,
        rowsLoaded: 0,
        fileRows: {},
        skipReason: null,
        errorMessage: null,
      })
      .where(and(eq(importJobs.id, jobId), eq(importJobs.status, "pending")));

    const running = await db
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(and(eq(importJobs.id, jobId), eq(importJobs.status, "running")))
      .limit(1);

    if (running.length === 0) {
      return;
    }

    sourceHashes = await hashAllSourceFiles();
    await touchImportJobHeartbeat(jobId);

    const storedHashes = await getStoredSourceHashes();
    if (storedHashes && sourceHashesEqual(sourceHashes, storedHashes)) {
      await db
        .update(importJobs)
        .set({
          status: "skipped",
          skipReason: "unchanged",
          finishedAt: new Date(),
          progressPhase: "skipped_unchanged",
          filesProcessed: 0,
          rowsLoaded: 0,
          fileRows: {},
        })
        .where(eq(importJobs.id, jobId));
      clearSummaryCache();
      return;
    }

    await prepareImportDiffOldTable();
    await touchImportJobHeartbeat(jobId);

    await db
      .update(importJobs)
      .set({ progressPhase: "clearing_staging" })
      .where(eq(importJobs.id, jobId));

    await clearStaging();

    let totalRowsLoaded = 0;
    let filesProcessed = 0;

    for (const file of SOURCE_FILES) {
      const rows = await loadSourceFile(jobId, file, totalRowsLoaded);
      loadedByFile[file.key] = rows;
      totalRowsLoaded += rows;
      filesProcessed += 1;

      await importPool().query(
        `
        UPDATE import_jobs
        SET
          rows_loaded = $2,
          files_processed = $3,
          progress_phase = $4,
          file_rows = $5::jsonb,
          updated_at = now()
        WHERE id = $1
      `,
        [
          jobId,
          totalRowsLoaded,
          filesProcessed,
          `loaded_${file.key}`,
          JSON.stringify(loadedByFile),
        ]
      );
    }

    await db
      .update(importJobs)
      .set({ progressPhase: "validating" })
      .where(eq(importJobs.id, jobId));

    await assertStagingImportComplete(loadedByFile);

    await db
      .update(importJobs)
      .set({ progressPhase: "computing_gaps" })
      .where(eq(importJobs.id, jobId));

    await assertImportJobStillRunning(jobId);
    await refreshAbcRangeGaps(RANGES_STAGING_TABLE);
    await touchImportJobHeartbeat(jobId);

    await db
      .update(importJobs)
      .set({ progressPhase: "computing_diff" })
      .where(eq(importJobs.id, jobId));

    await assertImportJobStillRunning(jobId);
    const [oldRanges, newRanges] = await Promise.all([
      loadImportDiffOldRanges(),
      loadStagingRangesForDiff(),
    ]);
    // First import: production was empty — no baseline to compare, skip diff snapshot.
    const diffSegments =
      oldRanges.length === 0 ? [] : diffRangeDatasets(oldRanges, newRanges);
    const diffCounts = countDiffSegments(diffSegments);
    await touchImportJobHeartbeat(jobId);

    await db
      .update(importJobs)
      .set({ progressPhase: "swapping" })
      .where(eq(importJobs.id, jobId));

    await assertImportJobStillRunning(jobId);
    await swapStagingToProduction();
    await touchImportJobHeartbeat(jobId);
    await analyzeRanges();
    await touchImportJobHeartbeat(jobId);

    const loadDate = mskLoadDateKey(new Date());
    const isFirstImport = oldRanges.length === 0;

    if (isFirstImport || diffSegments.length > 0) {
      await db
        .update(importJobs)
        .set({ progressPhase: "saving_version_snapshot" })
        .where(eq(importJobs.id, jobId));

      await assertImportJobStillRunning(jobId);
      await saveVersionSnapshot({
        jobId,
        loadDate,
        mode: isFirstImport ? "baseline" : "full_and_diff",
        segments: isFirstImport ? undefined : diffSegments,
        counts: isFirstImport ? undefined : diffCounts,
      });
      await touchImportJobHeartbeat(jobId);
    }

    await db
      .update(importJobs)
      .set({ progressPhase: "binding_uvr_antifraud" })
      .where(eq(importJobs.id, jobId));

    await assertImportJobStillRunning(jobId);
    await ensureOprRegisterLoaded();
    await refreshUvrAntifraudBinding();
    invalidateUvrAntifraudBindingCache();
    await touchImportJobHeartbeat(jobId);

    const stats = await refreshDatasetGlobalStats();
    const finishedAt = new Date();

    await saveDatasetMetaAfterImport({
      jobId,
      finishedAt,
      sourceHashes: sourceHashes!,
      stats,
    });

    await dropImportDiffOldTable();
    clearSummaryCache();

    await db
      .update(importJobs)
      .set({
        status: "completed",
        finishedAt,
        rowsLoaded: stats.totalRows,
        filesProcessed: SOURCE_FILES.length,
        progressPhase: "completed",
        errorMessage: null,
        fileRows: loadedByFile,
      })
      .where(eq(importJobs.id, jobId));
  } catch (error) {
    const message =
      error instanceof ImportValidationError ||
      error instanceof CsvParseIncompleteError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown import error";
    await failImportJob(jobId, message, loadedByFile);
    throw error;
  }
}

export async function getImportStatus(jobId?: string) {
  let job;
  if (jobId) {
    const rows = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId));
    job = rows[0];
  } else {
    const rows = await db
      .select()
      .from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(1);
    job = rows[0];
  }

  const meta = await db.select().from(datasetMeta).where(eq(datasetMeta.id, 1));
  const loadedAt = meta[0]?.lastSuccessAt?.toISOString() ?? null;

  if (!job) {
    return {
      jobId: "",
      status: "completed" as const,
      loadedAt,
    };
  }

  const fileRows = normalizeFileRows(job.fileRows);
  const status = job.status as
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "skipped";
  const phase = job.progressPhase ?? "";
  const filesProcessed = job.filesProcessed ?? 0;
  const filesTotal = job.filesTotal ?? 4;
  const rowsLoaded = job.rowsLoaded ?? 0;

  return {
    jobId: job.id,
    status,
    skipReason: job.skipReason ?? undefined,
    progress: buildImportProgressDisplay({
      status,
      phase,
      fileRows,
      filesProcessed,
      filesTotal,
      rowsLoaded,
    }),
    loadedAt,
    errorMessage: job.errorMessage ?? undefined,
    rowsLoaded,
  };
}
