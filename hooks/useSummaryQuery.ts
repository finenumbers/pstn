import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { serializeDatasetParam } from "@/packages/shared/contracts/dataset.schema";
import {
  type FiltersDTO,
  type SummaryResponse,
} from "@/packages/shared/contracts/filters.schema";
import { buildFilterParams, fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useSummaryQuery(
  filters: FiltersDTO,
  options?: { enabled?: boolean; dataset?: DatasetRef }
) {
  const dataset = options?.dataset ?? { kind: "current" as const };
  const datasetParam = serializeDatasetParam(dataset);

  return useQuery({
    queryKey: queryKeys.summary(filters, dataset),
    queryFn: async ({ signal }) => {
      const params = buildFilterParams(filters);
      params.set("dataset", datasetParam);
      return fetchJson<SummaryResponse>(`/api/summary?${params.toString()}`, {
        signal,
      });
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useGlobalSummaryQuery(dataset: DatasetRef = { kind: "current" }) {
  const datasetParam = serializeDatasetParam(dataset);

  return useQuery({
    queryKey: queryKeys.globalSummary(dataset),
    queryFn: () =>
      fetchJson<SummaryResponse>(`/api/summary?dataset=${datasetParam}`),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
