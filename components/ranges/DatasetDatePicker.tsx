"use client";

import { Input } from "@/components/ui/input";

export function DatasetDatePicker() {
  return (
    <Input
      className="h-9 w-[132px] tabular-nums"
      placeholder="ДД.ММ.ГГГГ"
      disabled
      title="Выбор даты датасета (скоро)"
      aria-label="Дата датасета"
    />
  );
}
