import { NextRequest, NextResponse } from "next/server";
import { importStatusQuerySchema } from "@/packages/shared/contracts/filters.schema";
import { getImportStatus } from "@/packages/import/importWorker";
import { apiError, validationError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = importStatusQuerySchema.safeParse({
      jobId: params.get("jobId") ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const status = await getImportStatus(parsed.data.jobId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("import status error:", error);
    return apiError(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
