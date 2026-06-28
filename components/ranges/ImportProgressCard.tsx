"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import type {
  ImportFileProgress,
  ImportStatusResponse,
} from "@/packages/shared/contracts/filters.schema";

interface ImportProgressCardProps {
  status: ImportStatusResponse;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ImportProgressCard({
  status,
  onDismiss,
  onRetry,
}: ImportProgressCardProps) {
  const progress = status.progress;
  if (!progress) return null;

  const isActive =
    status.status === "pending" || status.status === "running";
  const isSuccess =
    status.status === "completed" || status.status === "skipped";
  const isSkipped = status.status === "skipped";
  const isFailed = status.status === "failed";

  return (
    <Card
      className={cn(
        "border",
        isSuccess && !isSkipped && "border-green-200 bg-green-50/80",
        isSkipped && "border-blue-200 bg-blue-50/80",
        isFailed && "border-red-200 bg-red-50/80",
        isActive && "border-blue-200 bg-blue-50/80"
      )}
    >
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isActive && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
              )}
              {isSuccess && !isSkipped && (
                <CheckCircle2 className="h-4 w-4 text-green-700" />
              )}
              {isSkipped && (
                <CheckCircle2 className="h-4 w-4 text-blue-700" />
              )}
              {isFailed && <XCircle className="h-4 w-4 text-red-700" />}
              <span
                className={cn(
                  isSuccess && !isSkipped && "text-green-900",
                  isSkipped && "text-blue-900",
                  isFailed && "text-red-900",
                  isActive && "text-blue-900"
                )}
              >
                {isSkipped
                  ? "Данные актуальны"
                  : isSuccess
                  ? "Загрузка завершена"
                  : isFailed
                    ? "Загрузка не завершена"
                    : "Загрузка данных с opendata.digital.gov.ru"}
              </span>
            </div>
            <p
              className={cn(
                "text-sm",
                isSuccess && !isSkipped && "text-green-800",
                isSkipped && "text-blue-800",
                isFailed && "text-red-800",
                isActive && "text-blue-800"
              )}
            >
              {progress.phaseLabel}
            </p>
          </div>

          {!isActive && onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Скрыть
            </Button>
          )}
        </div>

        {isActive && (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-blue-800">
              {progress.percent}% · файлов {progress.filesProcessed}/
              {progress.filesTotal}
            </p>
          </div>
        )}

        {!isSkipped && (
          <ul className="grid grid-cols-4 gap-2">
            {progress.files.map((file) => (
              <FileProgressRow key={file.key} file={file} />
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {!isSkipped && (
            <p className="tabular-nums text-muted-foreground">
              Всего загружено:{" "}
              <span className="font-medium text-foreground">
                {formatNumber(progress.rowsLoaded)}
              </span>{" "}
              {isSuccess && progress.filesTotal === progress.filesProcessed
                ? `· ${progress.filesTotal}/${progress.filesTotal} файла`
                : null}
            </p>
          )}

          {isFailed && onRetry && (
            <Button size="sm" onClick={onRetry}>
              Загрузить снова
            </Button>
          )}
        </div>

        {isSkipped && (
          <div className="rounded-md border border-blue-200 bg-white/70 px-3 py-2 text-sm text-blue-900">
            Данные актуальны, обновление не требуется.
          </div>
        )}

        {isFailed && status.errorMessage && (
          <div className="rounded-md border border-red-200 bg-white/70 px-3 py-2 text-sm text-red-900">
            {status.errorMessage}
          </div>
        )}

        {isFailed && (
          <p className="text-xs text-red-800">
            Текущие данные в таблице не изменены.
          </p>
        )}

        {isActive && progress.steps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {progress.steps.map((step) => (
              <span
                key={step.id}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  step.status === "done" &&
                    "bg-green-100 text-green-800",
                  step.status === "active" &&
                    "bg-blue-100 text-blue-800",
                  step.status === "pending" &&
                    "bg-muted text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileProgressRow({ file }: { file: ImportFileProgress }) {
  const Icon = FILE_STATUS_ICON[file.status];

  return (
    <li className="flex items-center gap-2 rounded-md border bg-background/80 px-3 py-2 text-sm">
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          file.status === "done" && "text-green-600",
          file.status === "loading" && "animate-spin text-blue-600",
          file.status === "failed" && "text-red-600",
          file.status === "pending" && "text-muted-foreground"
        )}
      />
      <span className="min-w-0 flex-1 font-medium">
        {file.key} (МинЦифры)
      </span>
      <span className="tabular-nums text-muted-foreground">
        {file.status === "loading"
          ? "загрузка…"
          : file.rows != null
            ? formatNumber(file.rows)
            : "—"}
      </span>
    </li>
  );
}

const FILE_STATUS_ICON: Record<ImportFileProgress["status"], LucideIcon> = {
  done: CheckCircle2,
  loading: Loader2,
  failed: XCircle,
  pending: Circle,
};
