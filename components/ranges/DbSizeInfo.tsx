"use client";

import { formatAsOfDisplayDate } from "@/packages/shared/contracts/dataset.schema";
import { useStorageQuery } from "@/hooks/useStorageQuery";
import { Skeleton } from "@/components/ui/skeleton";

export function DbSizeInfo() {
  const storageQuery = useStorageQuery();

  return (
    <div
      className="hidden h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-xs sm:flex"
      title="Размер базы данных PostgreSQL"
    >
      {storageQuery.isLoading ? (
        <Skeleton className="h-3 w-16" />
      ) : (
        <span className="font-bold tabular-nums text-foreground">
          БД: {storageQuery.data?.formatted ?? "—"}
        </span>
      )}
    </div>
  );
}

export function HistoricalDatasetBanner({
  asOf,
  versionLoadDate,
}: {
  asOf: string;
  versionLoadDate?: string | null;
}) {
  const versionLabel = versionLoadDate
    ? formatAsOfDisplayDate(versionLoadDate.slice(0, 10))
    : null;

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
      План на {formatAsOfDisplayDate(asOf)}
      {versionLabel ? ` (версия от ${versionLabel})` : ""}
      {" · "}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => {
          const params = new URLSearchParams(window.location.search);
          params.delete("asOf");
          const qs = params.toString();
          window.location.href = qs
            ? `${window.location.pathname}?${qs}`
            : window.location.pathname;
        }}
      >
        Вернуться к текущему датасету
      </button>
    </div>
  );
}
