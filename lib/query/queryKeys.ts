import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { serializeDatasetParam } from "@/packages/shared/contracts/dataset.schema";

export const queryKeys = {
  ranges: (params: Record<string, unknown>) => ["ranges", params] as const,
  facets: (params: Record<string, unknown>) => ["facets", params] as const,
  summary: (filters: unknown, dataset?: DatasetRef, asOf?: string | null) =>
    [
      "summary",
      dataset ? serializeDatasetParam(dataset) : "current",
      asOf ?? "",
      filters,
    ] as const,
  globalSummary: (dataset?: DatasetRef, asOf?: string | null) =>
    [
      "summary",
      dataset ? serializeDatasetParam(dataset) : "current",
      asOf ?? "",
      "global",
    ] as const,
  datasets: () => ["datasets"] as const,
  changeDates: () => ["datasets", "change-dates"] as const,
  storage: () => ["storage"] as const,
  importStatus: (jobId: string) => ["import", "status", jobId] as const,
};
