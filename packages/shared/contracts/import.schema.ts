/** Shared import job / progress types (API contract + UI). */

export type ImportJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type ImportFileStatus = "pending" | "loading" | "done" | "failed";

export type ImportStepStatus = "pending" | "active" | "done";

export interface ImportFileProgress {
  key: string;
  status: ImportFileStatus;
  rows: number | null;
}

export interface ImportStepProgress {
  id: string;
  label: string;
  status: ImportStepStatus;
}

export interface PartyEnrichmentProgress {
  total: number;
  done: number;
  withAddress: number;
  empty: number;
  stopReason: string | null;
}

export interface ImportProgress {
  phase: string;
  phaseLabel: string;
  percent: number;
  filesProcessed: number;
  filesTotal: number;
  rowsLoaded: number;
  files: ImportFileProgress[];
  steps: ImportStepProgress[];
  partyEnrichment: PartyEnrichmentProgress;
}

export interface ImportStatusResponse {
  jobId: string;
  status: ImportJobStatus;
  skipReason?: string;
  progress?: ImportProgress;
  loadedAt: string | null;
  errorMessage?: string;
  rowsLoaded?: number;
}
