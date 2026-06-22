import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  type FiltersDTO,
  type SummaryResponse,
} from "@/packages/shared/contracts/filters.schema";
import { buildFilterParams, fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useSummaryQuery(filters: FiltersDTO, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.summary(filters),
    queryFn: async () => {
      const params = buildFilterParams(filters);
      return fetchJson<SummaryResponse>(`/api/summary?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useGlobalSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.globalSummary(),
    queryFn: () => fetchJson<SummaryResponse>("/api/summary"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
