import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startImportFromUi } from "@/app/actions/import";
import { type ImportStatusResponse } from "@/packages/shared/contracts/filters.schema";
import { fetchJson } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useImportStart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startImportFromUi(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import"] });
    },
  });
}

export function useImportStatus(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.importStatus(jobId ?? "latest"),
    queryFn: () =>
      fetchJson<ImportStatusResponse>(
        jobId
          ? `/api/import/status?jobId=${encodeURIComponent(jobId)}`
          : "/api/import/status"
      ),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "pending") return 1000;
      return false;
    },
  });
}
