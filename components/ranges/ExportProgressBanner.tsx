"use client";

import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExportProgressBannerProps = {
  status: string;
  rowsWritten: number;
  totalRows: number;
  onCancel?: () => void;
  onDismiss?: () => void;
};

export function ExportProgressBanner({
  status,
  rowsWritten,
  totalRows,
  onCancel,
  onDismiss,
}: ExportProgressBannerProps) {
  const isActive = status === "pending" || status === "running";
  const isDone = status === "completed";
  const isFailed = status === "failed" || status === "cancelled";
  const pct =
    totalRows > 0
      ? Math.min(100, Math.round((rowsWritten / totalRows) * 100))
      : 0;

  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        isActive && "border-blue-200 bg-blue-50 text-blue-950",
        isDone && "border-green-200 bg-green-50 text-green-950",
        isFailed && "border-red-200 bg-red-50 text-red-950"
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isActive && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="font-medium">
            {isActive && "Формируем XLSX…"}
            {isDone && "Экспорт XLSX готов"}
            {status === "failed" && "Ошибка экспорта XLSX"}
            {status === "cancelled" && "Экспорт отменён"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Отменить
            </Button>
          )}
          {(isDone || isFailed) && onDismiss && (
            <button
              type="button"
              className="rounded p-1 hover:bg-black/5"
              onClick={onDismiss}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {totalRows > 0 && (
        <p className="mt-1 tabular-nums">
          {rowsWritten.toLocaleString("ru-RU")} /{" "}
          {totalRows.toLocaleString("ru-RU")} строк ({pct}%)
        </p>
      )}
      {isActive && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
