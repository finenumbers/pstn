"use server";

import { startImportJob } from "@/packages/import/importWorker";

export async function startImportFromUi(): Promise<{
  jobId: string;
  status: string;
}> {
  return startImportJob("manual");
}
