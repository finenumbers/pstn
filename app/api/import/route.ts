import { NextRequest, NextResponse } from "next/server";
import { startImportJob } from "@/packages/import/importWorker";
import { internalServerError } from "@/lib/api/errors";
import { checkImportAuthorization } from "@/lib/api/importAuth";

export async function POST(request: NextRequest) {
  const authError = checkImportAuthorization(request);
  if (authError) {
    return authError;
  }

  try {
    const result = await startImportJob();
    return NextResponse.json({
      jobId: result.jobId,
      status: result.status,
    });
  } catch (error) {
    return internalServerError(error, "Import failed");
  }
}
