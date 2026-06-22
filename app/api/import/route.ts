import { NextRequest, NextResponse } from "next/server";
import { startImportJob } from "@/packages/import/importWorker";
import { apiError } from "@/lib/api/errors";
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
    console.error("import start error:", error);
    return apiError(
      "IMPORT_FAILED",
      error instanceof Error ? error.message : "Import failed",
      500
    );
  }
}
