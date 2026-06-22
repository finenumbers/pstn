import { normalizeFilters, type FiltersDTO } from "@/packages/shared/contracts/filters.schema";

export const queryKeys = {
  ranges: (params: Record<string, unknown>) => ["ranges", params] as const,
  facets: (params: Record<string, unknown>) => ["facets", params] as const,
  summary: (filters: FiltersDTO) =>
    ["summary", normalizeFilters(filters)] as const,
  globalSummary: () => ["summary", "global"] as const,
  importStatus: (jobId: string) => ["import", "status", jobId] as const,
};
