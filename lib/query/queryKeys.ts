import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { serializeDatasetParam } from "@/packages/shared/contracts/dataset.schema";

export const queryKeys = {
  ranges: (params: Record<string, unknown>) => ["ranges", params] as const,
  facets: (params: Record<string, unknown>) => ["facets", params] as const,
  summary: (filters: unknown, dataset?: DatasetRef) =>
    ["summary", dataset ? serializeDatasetParam(dataset) : "current", filters] as const,
  globalSummary: (dataset?: DatasetRef) =>
    ["summary", dataset ? serializeDatasetParam(dataset) : "current", "global"] as const,
  datasets: () => ["datasets"] as const,
  importStatus: (jobId: string) => ["import", "status", jobId] as const,
};
