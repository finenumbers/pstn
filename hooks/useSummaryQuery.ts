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
  options?: { enabled?: boolean; dataset?: DatasetRef; asOf?: string | null }
) {
  const dataset = options?.dataset ?? { kind: "current" as const };
  const asOf = options?.asOf ?? null;
  const datasetParam = serializeDatasetParam(dataset);

  return useQuery({
    queryKey: queryKeys.summary(filters, dataset, asOf),
    queryFn: async ({ signal }) => {
      const params = buildFilterParams(filters);
      params.set("dataset", datasetParam);
      if (asOf && dataset.kind === "current") {
        params.set("asOf", asOf);
      }
      return fetchJson<SummaryResponse>(`/api/summary?${params.toString()}`, {
        signal,
      });
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useGlobalSummaryQuery(
  dataset: DatasetRef = { kind: "current" },
  asOf?: string | null
) {
  const datasetParam = serializeDatasetParam(dataset);

  return useQuery({
    queryKey: queryKeys.globalSummary(dataset, asOf),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("dataset", datasetParam);
      if (asOf && dataset.kind === "current") {
        params.set("asOf", asOf);
      }
      return fetchJson<SummaryResponse>(`/api/summary?${params.toString()}`);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
