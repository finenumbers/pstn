import { useInfiniteQuery } from "@tanstack/react-query";
import {
  serializeSort,
  type FiltersDTO,
  type RangesListResponse,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import { buildFilterParams, fetchJson } from "@/lib/api/client";
import { encodeRangesCursor } from "@/lib/api/rangesCursor";
import { queryKeys } from "@/lib/query/queryKeys";

export function useRangesInfiniteQuery(params: {
  filters: FiltersDTO;
  sorting: { id: SortableColumn; desc: boolean }[];
  pageSize: number;
}) {
  const sort = serializeSort(params.sorting);

  return useInfiniteQuery({
    queryKey: queryKeys.ranges({
      filters: params.filters,
      sort,
      pageSize: params.pageSize,
    }),
    queryFn: async ({ pageParam }) => {
      const filterParams = buildFilterParams(params.filters);
      filterParams.set("pageSize", String(params.pageSize));
      filterParams.set("sort", sort);
      if (pageParam) {
        filterParams.set("cursor", pageParam);
      } else {
        filterParams.set("page", "1");
      }
      return fetchJson<RangesListResponse>(
        `/api/ranges?${filterParams.toString()}`
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.hasMore || lastPage.data.length === 0) {
        return undefined;
      }
      return encodeRangesCursor(lastPage.data[lastPage.data.length - 1]);
    },
    staleTime: 60_000,
  });
}
