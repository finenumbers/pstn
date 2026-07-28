import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getImportStatusFromUi,
  startImportFromUi,
} from "@/app/actions/import";
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
    queryFn: () => getImportStatusFromUi(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "pending") return 1000;
      return false;
    },
  });
}
