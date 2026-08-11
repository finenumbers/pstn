import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
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
    if (job.status !== "completed" || !job.filePath) {
      return apiError(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Файл экспорта ещё не готов.",
        409,
        { status: job.status }
      );
    }

    const info = await stat(job.filePath);
    const nodeStream = createReadStream(job.filePath);
    const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new Response(body, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=ranges-export.xlsx",
        "Content-Length": String(info.size),
        "X-Export-Row-Count": String(job.rowsWritten),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return internalServerError(error, "Не удалось скачать файл экспорта.");
  }
}
