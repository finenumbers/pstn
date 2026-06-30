import { useInfiniteQuery } from "@tanstack/react-query";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { serializeDatasetParam } from "@/packages/shared/contracts/dataset.schema";
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
  dataset: DatasetRef;
  asOf?: string | null;
}) {
  const sort = serializeSort(params.sorting);
  const datasetParam = serializeDatasetParam(params.dataset);

  return useInfiniteQuery({
    queryKey: queryKeys.ranges({
      filters: params.filters,
      sort,
      pageSize: params.pageSize,
      dataset: datasetParam,
      asOf: params.asOf ?? "",
    }),
    queryFn: async ({ pageParam, signal }) => {
      const filterParams = buildFilterParams(params.filters);
      filterParams.set("pageSize", String(params.pageSize));
      filterParams.set("sort", sort);
      filterParams.set("dataset", datasetParam);
      if (params.asOf && params.dataset.kind === "current") {
        filterParams.set("asOf", params.asOf);
      }
      if (pageParam) {
        filterParams.set("cursor", pageParam);
      } else {
        filterParams.set("page", "1");
      }
      return fetchJson<RangesListResponse>(
        `/api/ranges?${filterParams.toString()}`,
        { signal }
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
