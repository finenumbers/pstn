import { NextResponse } from "next/server";
import { cancelExportJob } from "@/packages/export/exportWorker";
import { apiError, internalServerError } from "@/lib/api/errors";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const ok = await cancelExportJob(id);
    if (!ok) {
      return apiError(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Не удалось отменить экспорт (задача не найдена или уже завершена).",
        409
      );
    }
    return NextResponse.json({ jobId: id, status: "cancelled" });
  } catch (error) {
    return internalServerError(error, "Не удалось отменить экспорт.");
  }
}
