import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { EXPORT_DIR } from "./exportJobConstants";

export function ensureExportDir(): string {
  mkdirSync(EXPORT_DIR, { recursive: true });
  return EXPORT_DIR;
}

export function exportFilePath(jobId: string): string {
  return join(ensureExportDir(), `${jobId}.xlsx`);
}
