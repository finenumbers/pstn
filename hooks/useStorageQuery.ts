import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

type StorageResponse = {
  databaseBytes: number;
  formatted: string;
};

export function useStorageQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.storage(),
    queryFn: () => fetchJson<StorageResponse>("/api/storage"),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
