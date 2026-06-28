import { NextRequest, NextResponse } from "next/server";
import {
  startImportJob,
  type ImportTriggeredBy,
} from "@/packages/import/importWorker";
import { internalServerError } from "@/lib/api/errors";
import {
  checkImportAuthorization,
  requireImportSecret,
} from "@/lib/api/importAuth";

export async function POST(request: NextRequest) {
  let triggeredBy: ImportTriggeredBy = "manual";

  try {
    const body = (await request.json()) as { triggeredBy?: string };
    if (body.triggeredBy === "cron") {
      triggeredBy = "cron";
    }
  } catch {
    // empty body defaults to manual
  }

  if (triggeredBy === "cron") {
    const cronAuthError = requireImportSecret(request);
    if (cronAuthError) {
      return cronAuthError;
    }
  } else {
    const authError = checkImportAuthorization(request);
    if (authError) {
      return authError;
    }
  }

  try {
    const result = await startImportJob(triggeredBy);
    return NextResponse.json({
      jobId: result.jobId,
      status: result.status,
    });
  } catch (error) {
    return internalServerError(error, "Import failed");
  }
}
