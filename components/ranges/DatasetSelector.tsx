"use client";

import {
  DATASET_CURRENT_ID,
  serializeDatasetParam,
  type DatasetListItem,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { useDatasetsQuery } from "@/hooks/useDatasetsQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DatasetSelectorProps {
  value: DatasetRef;
  onChange: (value: DatasetRef) => void;
  disabled?: boolean;
}

function itemToRef(item: DatasetListItem): DatasetRef {
  if (item.kind === "current") {
    return { kind: "current" };
  }
  return { kind: "diff", snapshotId: item.id };
}

function refToSelectValue(ref: DatasetRef): string {
  return serializeDatasetParam(ref);
}

function selectValueToRef(value: string): DatasetRef {
  if (value === DATASET_CURRENT_ID) {
    return { kind: "current" };
  }
  return { kind: "diff", snapshotId: value.slice("diff:".length) };
}

function formatItemDate(label: string): string {
  const match = label.match(/(\d{2}\.\d{2}\.\d{4})/);
  return match?.[1] ?? label;
}

export function DatasetSelector({
  value,
  onChange,
  disabled,
}: DatasetSelectorProps) {
  const datasetsQuery = useDatasetsQuery();
  const items = datasetsQuery.data?.items ?? [];
  const selectedValue = refToSelectValue(value);
  const selectedItem = items.find(
    (item) => refToSelectValue(itemToRef(item)) === selectedValue
  );

  if (datasetsQuery.isLoading) {
    return (
      <div className="flex h-9 w-fit min-w-[8ch] items-center rounded-md border border-input bg-background px-3">
        <Skeleton className="h-4 w-[22ch]" />
      </div>
    );
  }

  if (datasetsQuery.isError) {
    return (
      <div
        className="flex h-9 w-fit min-w-[8ch] items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs text-amber-900"
        title="Не удалось загрузить список датасетов"
      >
        Датасеты недоступны
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <label className="relative flex h-9 w-fit min-w-[8ch] items-center rounded-md border border-input bg-background px-3 text-sm">
      <span className="sr-only">Выбор датасета</span>
      <span className="pointer-events-none whitespace-nowrap">
        {selectedItem ? (
          <DatasetLabel label={selectedItem.label} />
        ) : (
          "Датасет"
        )}
      </span>
      <select
        className={cn(
          "absolute inset-0 h-full w-full cursor-pointer opacity-0",
          disabled && "cursor-not-allowed"
        )}
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => onChange(selectValueToRef(event.target.value))}
        aria-label="Выбор датасета"
      >
        {items.map((item: DatasetListItem) => (
          <option key={item.id} value={refToSelectValue(itemToRef(item))}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DatasetLabel({ label }: { label: string }) {
  const date = formatItemDate(label);
  const prefix = label.replace(date, "").trim();
  return (
    <span>
      {prefix}{" "}
      <span className="font-semibold tabular-nums text-green-600">{date}</span>
    </span>
  );
}
