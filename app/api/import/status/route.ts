import { NextRequest, NextResponse } from "next/server";
import { importStatusQuerySchema } from "@/packages/shared/contracts/filters.schema";
import { checkImportAuthorization } from "@/lib/api/importAuth";
import { getImportStatus } from "@/packages/import/importWorker";
import { internalServerError, validationError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const authError = checkImportAuthorization(request);
  if (authError) {
    return authError;
  }

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
    return internalServerError(error);
  }
}
