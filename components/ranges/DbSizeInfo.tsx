"use client";

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
      ) : storageQuery.isError ? (
        <span className="font-bold tabular-nums text-amber-800">БД: недоступно</span>
      ) : (
        <span className="font-bold tabular-nums text-foreground">
          БД: {storageQuery.data?.formatted ?? "—"}
        </span>
      )}
    </div>
  );
}
