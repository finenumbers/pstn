"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatPhoneMaskHint,
  isPhoneMaskEmpty,
  normalizePhoneMask,
} from "@/lib/phoneNumberMask";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";

const FILTER_LABELS: Record<string, string> = {
  abc: "ABC",
  operator: "Оператор связи",
  garTerritory: "Территория ГАР",
  region: "Регион",
  inn: "ИНН",
  uvrAntifraud: "УВр Антифрод",
  phoneNumber: "Номер",
  rangeStart: "Начало",
  rangeEnd: "Конец",
  capacity: "Емкость",
};

interface FilterChip {
  field: keyof FiltersDTO;
  label: string;
  value: string;
  display: string;
}

interface ActiveFilterChipsProps {
  filters: FiltersDTO;
  onRemove: (field: keyof FiltersDTO, value?: string) => void;
}

function pushFacetChips(
  chips: FilterChip[],
  field:
    | "abc"
    | "operator"
    | "garTerritory"
    | "region"
    | "inn"
    | "uvrAntifraud",
  values: string[],
  formatDisplay?: (value: string) => string
) {
  const label = FILTER_LABELS[field];
  for (const value of values) {
    chips.push({
      field,
      label,
      value,
      display: formatDisplay?.(value) ?? value,
    });
  }
}

export function ActiveFilterChips({
  filters,
  onRemove,
}: ActiveFilterChipsProps) {
  const chips: FilterChip[] = [];

  pushFacetChips(chips, "abc", filters.abc);
  pushFacetChips(chips, "operator", filters.operator);
  pushFacetChips(chips, "garTerritory", filters.garTerritory);
  pushFacetChips(chips, "region", filters.region);

  pushFacetChips(chips, "inn", filters.inn);
  pushFacetChips(chips, "uvrAntifraud", filters.uvrAntifraud);

  if (!isPhoneMaskEmpty(filters.phoneNumber)) {
    chips.push({
      field: "phoneNumber",
      label: FILTER_LABELS.phoneNumber,
      value: filters.phoneNumber,
      display: formatPhoneMaskHint(normalizePhoneMask(filters.phoneNumber)),
    });
  }
  if (filters.rangeStart) {
    chips.push({
      field: "rangeStart",
      label: FILTER_LABELS.rangeStart,
      value: filters.rangeStart,
      display: filters.rangeStart,
    });
  }
  if (filters.rangeEnd) {
    chips.push({
      field: "rangeEnd",
      label: FILTER_LABELS.rangeEnd,
      value: filters.rangeEnd,
      display: filters.rangeEnd,
    });
  }
  if (filters.capacity) {
    chips.push({
      field: "capacity",
      label: FILTER_LABELS.capacity,
      value: filters.capacity,
      display: filters.capacity,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
    >
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        Активные фильтры:
      </span>
      {chips.map((chip) => (
        <Badge
          key={`${chip.field}-${chip.value || "__empty__"}`}
          variant="secondary"
        >
          <span className="mr-1 text-muted-foreground">{chip.label}:</span>
          <span className="max-w-[200px] truncate">{chip.display}</span>
          <button
            type="button"
            className="ml-1 rounded-full hover:bg-muted"
            onClick={() => onRemove(chip.field, chip.value)}
            aria-label={`Убрать фильтр ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
