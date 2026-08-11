"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  DATASET_CURRENT_ID,
  serializeDatasetParam,
  type DatasetListItem,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import {
  formatDiffDayLabel,
  groupDiffDatasetsByMonth,
} from "@/lib/datasets/groupDiffDatasets";
import { useDatasetsQuery } from "@/hooks/useDatasetsQuery";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function DatasetSelector({
  value,
  onChange,
  disabled,
}: DatasetSelectorProps) {
  const datasetsQuery = useDatasetsQuery();
  const items = useMemo(
    () => datasetsQuery.data?.items ?? [],
    [datasetsQuery.data?.items]
  );
  const selectedValue = refToSelectValue(value);
  const selectedItem = items.find(
    (item) => refToSelectValue(itemToRef(item)) === selectedValue
  );

  const currentItem = items.find((item) => item.kind === "current");
  const monthGroups = useMemo(
    () => groupDiffDatasetsByMonth(items),
    [items]
  );

  const selectedMonthKey =
    selectedItem?.kind === "diff"
      ? selectedItem.loadDate.slice(0, 7)
      : null;

  const [open, setOpen] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(
    selectedMonthKey
  );

  if (datasetsQuery.isLoading) {
    return (
      <div className="flex h-9 w-[200px] items-center rounded-md border border-input bg-background px-3">
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (datasetsQuery.isError) {
    return (
      <div
        className="flex h-9 w-[200px] items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs text-amber-900"
        title="Не удалось загрузить список датасетов"
      >
        Датасеты недоступны
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const selectItem = (item: DatasetListItem) => {
    onChange(itemToRef(item));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && selectedMonthKey) {
          setExpandedMonth(selectedMonthKey);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 text-sm",
            disabled && "cursor-not-allowed opacity-50"
          )}
          aria-label="Выбор датасета"
        >
          <span className="min-w-0 truncate text-left">
            {selectedItem ? (
              <DatasetTriggerLabel item={selectedItem} />
            ) : (
              "Датасет"
            )}
          </span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          {currentItem && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                selectedValue === DATASET_CURRENT_ID && "bg-accent"
              )}
              onClick={() => selectItem(currentItem)}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  selectedValue === DATASET_CURRENT_ID
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
              <DatasetTriggerLabel item={currentItem} />
            </button>
          )}

          {monthGroups.map((group) => {
            const isExpanded = expandedMonth === group.monthKey;
            const hasSelected = group.items.some(
              (item) => refToSelectValue(itemToRef(item)) === selectedValue
            );
            return (
              <div key={group.monthKey}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    hasSelected && !isExpanded && "bg-accent/60"
                  )}
                  onClick={() =>
                    setExpandedMonth(isExpanded ? null : group.monthKey)
                  }
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  )}
                  <span className="truncate font-medium">{group.label}</span>
                </button>
                {isExpanded && (
                  <div className="ml-2 border-l border-border pl-1">
                    {group.items.map((item) => {
                      const itemValue = refToSelectValue(itemToRef(item));
                      const selected = itemValue === selectedValue;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                            selected && "bg-accent"
                          )}
                          onClick={() => selectItem(item)}
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              selected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-semibold tabular-nums text-green-600">
                            {formatDiffDayLabel(item.loadDate)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DatasetTriggerLabel({ item }: { item: DatasetListItem }) {
  if (item.kind === "diff") {
    return (
      <span>
        Расхождения{" "}
        <span className="font-semibold tabular-nums text-green-600">
          {formatDiffDayLabel(item.loadDate)}
        </span>
      </span>
    );
  }

  const date = formatDiffDayLabel(item.loadDate);
  const prefix = item.label.replace(date, "").trim();
  return (
    <span>
      {prefix}{" "}
      <span className="font-semibold tabular-nums text-green-600">{date}</span>
    </span>
  );
}
