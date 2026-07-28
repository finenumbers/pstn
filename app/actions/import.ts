"use server";

import { getImportStatus, startImportJob } from "@/packages/import/importWorker";
import type { ImportStatusResponse } from "@/packages/shared/contracts/filters.schema";

export async function startImportFromUi(): Promise<{
  jobId: string;
  status: string;
}> {
  return startImportJob("manual");
}

export async function getImportStatusFromUi(
  jobId?: string | null
): Promise<ImportStatusResponse> {
  return getImportStatus(jobId ?? undefined);
}
