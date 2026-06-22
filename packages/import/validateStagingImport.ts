import type { LoadedRowsBySource, SourceFileKey } from "./constants";
import { SOURCE_FILES } from "./constants";
import { importPool } from "@/packages/db";
import { RANGES_STAGING_TABLE } from "@/packages/db/importTables";

/**
 * Safety floor per file (≈95% of typical MinDigital volume).
 * Full-load policy still requires exact parsed↔staging match for every file.
 */
export const SOURCE_FILE_MIN_ROWS: Record<SourceFileKey, number> = {
  "ABC-3xx": 65_000,
  "ABC-4xx": 270_000,
  "ABC-8xx": 70_000,
  "DEF-9xx": 15_000,
};

export class ImportValidationError extends Error {
  readonly code = "IMPORT_VALIDATION_FAILED" as const;

  constructor(
    message: string,
    readonly details: {
      sourceFile?: SourceFileKey;
      rowCount?: number;
      expected?: number;
      minRows?: number;
    }[] = []
  ) {
    super(message);
    this.name = "ImportValidationError";
  }
}

async function countStagingRowsBySource(): Promise<
  Map<SourceFileKey, number>
> {
  const result = await importPool().query<{
    source_file: string;
    count: string;
  }>(`
    SELECT source_file, COUNT(*)::text AS count
    FROM ${RANGES_STAGING_TABLE}
    GROUP BY source_file
  `);

  const counts = new Map<SourceFileKey, number>();
  for (const row of result.rows) {
    counts.set(row.source_file as SourceFileKey, Number(row.count));
  }
  return counts;
}

export function validateFullStagingLoad(
  stagingCounts: Map<SourceFileKey, number>,
  loadedByFile: LoadedRowsBySource
): void {
  const failures: ImportValidationError["details"] = [];

  for (const file of SOURCE_FILES) {
    const parsed = loadedByFile[file.key];
    const inStaging = stagingCounts.get(file.key) ?? 0;
    const minRows = SOURCE_FILE_MIN_ROWS[file.key];

    if (inStaging < minRows) {
      failures.push({
        sourceFile: file.key,
        rowCount: inStaging,
        minRows,
      });
    }

    if (parsed !== inStaging) {
      failures.push({
        sourceFile: file.key,
        rowCount: inStaging,
        expected: parsed,
      });
    }
  }

  for (const file of SOURCE_FILES) {
    if (!stagingCounts.has(file.key)) {
      failures.push({
        sourceFile: file.key,
        rowCount: 0,
        minRows: SOURCE_FILE_MIN_ROWS[file.key],
      });
    }
  }

  if (failures.length === 0) return;

  const summary = failures
    .map((f) => {
      if (f.expected != null && f.rowCount != null) {
        return `${f.sourceFile}: staging ${f.rowCount.toLocaleString("ru-RU")} ≠ parsed ${f.expected.toLocaleString("ru-RU")}`;
      }
      if (f.minRows != null && f.rowCount != null) {
        return `${f.sourceFile}: ${f.rowCount.toLocaleString("ru-RU")} rows (min ${f.minRows.toLocaleString("ru-RU")})`;
      }
      return `${f.sourceFile}: missing`;
    })
    .join("; ");

  throw new ImportValidationError(
    `Full import validation failed — all four MinDigital CSV files must load completely (${summary})`,
    failures
  );
}

export async function assertStagingImportComplete(
  loadedByFile: LoadedRowsBySource
): Promise<Map<SourceFileKey, number>> {
  const stagingCounts = await countStagingRowsBySource();
  validateFullStagingLoad(stagingCounts, loadedByFile);
  return stagingCounts;
}
