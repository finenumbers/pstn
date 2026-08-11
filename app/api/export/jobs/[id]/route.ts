import { NextResponse } from "next/server";
import { getExportJobStatus } from "@/packages/export/exportWorker";
import { apiError, internalServerError } from "@/lib/api/errors";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const job = await getExportJobStatus(id);
    if (!job) {
      return apiError(
        API_ERROR_CODES.DATASET_NOT_FOUND,
        "Задача экспорта не найдена.",
        404
      );
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      totalRows: job.totalRows,
      rowsWritten: job.rowsWritten,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  } catch (error) {
    return internalServerError(error, "Не удалось получить статус экспорта.");
  }
}
