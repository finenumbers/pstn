import { useQuery } from "@tanstack/react-query";
import type { DatasetsResponse } from "@/packages/shared/contracts/dataset.schema";
import { fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useDatasetsQuery() {
  return useQuery({
    queryKey: queryKeys.datasets(),
    queryFn: () => fetchJson<DatasetsResponse>("/api/datasets"),
    staleTime: 60_000,
  });
}
