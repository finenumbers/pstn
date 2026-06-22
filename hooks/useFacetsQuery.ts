import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  normalizeFilters,
  FACET_COLUMNS,
  type FacetsResponse,
  type FiltersDTO,
} from "@/packages/shared/contracts/filters.schema";
import { buildFilterParams, fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

function normalizeFacetSearch(
  facetSearch: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(facetSearch).filter(([, v]) => v.trim().length > 0)
  );
}

export function useFacetsQuery(
  filters: FiltersDTO,
  facetSearch: Record<string, string>
) {
  const activeFacetSearch = normalizeFacetSearch(facetSearch);
  const normalizedFilters = normalizeFilters(filters);
  const params = { filters: normalizedFilters, facetSearch: activeFacetSearch };

  return useQuery({
    queryKey: queryKeys.facets(params),
    queryFn: async () => {
      const filterParams = buildFilterParams(normalizedFilters);
      filterParams.set("columns", FACET_COLUMNS.join(","));
      for (const [col, search] of Object.entries(activeFacetSearch)) {
        filterParams.set(`search.${col}`, search);
      }
      return fetchJson<FacetsResponse>(
        `/api/ranges/facets?${filterParams.toString()}`
      );
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
