import { useQuery } from "@tanstack/react-query";
import type { ChangeDatesResponse } from "@/packages/shared/contracts/dataset.schema";
import { fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useChangeDatesQuery() {
  return useQuery({
    queryKey: queryKeys.changeDates(),
    queryFn: () => fetchJson<ChangeDatesResponse>("/api/datasets/change-dates"),
    staleTime: 60_000,
  });
}
