"use client";

import { useMemo } from "react";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChangeDatesQuery } from "@/hooks/useChangeDatesQuery";
import { cn } from "@/lib/utils";

interface DatasetDatePickerProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
}

function isoFromDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DatasetDatePicker({
  value,
  onChange,
  disabled,
}: DatasetDatePickerProps) {
  const changeDatesQuery = useChangeDatesQuery();

  const changeDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of changeDatesQuery.data?.items ?? []) {
      set.add(item.loadDate);
    }
    return set;
  }, [changeDatesQuery.data?.items]);

  const baselineDates = useMemo(() => {
    const set = new Set<string>();
    for (const item of changeDatesQuery.data?.items ?? []) {
      if (!item.hasDiff) {
        set.add(item.loadDate);
      }
    }
    return set;
  }, [changeDatesQuery.data?.items]);

  const selectedDate = value ? parseISO(value) : undefined;
  const label = value
    ? format(parseISO(value), "dd.MM.yyyy")
    : "Дата датасета";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-[148px] justify-start px-3 font-normal tabular-nums",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
          aria-label="Дата датасета"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange?.(isoFromDate(date));
          }}
          modifiers={{
            versionDay: (date) => changeDateSet.has(isoFromDate(date)),
            baselineDay: (date) => baselineDates.has(isoFromDate(date)),
          }}
          modifiersClassNames={{
            versionDay:
              "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-blue-600",
            baselineDay:
              "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-blue-300",
          }}
          disabled={(date) => date > new Date()}
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="h-8 w-full text-xs"
              onClick={() => onChange?.(null)}
            >
              Сбросить дату
            </Button>
          </div>
        )}
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          Синяя точка — день изменений; светлая — первая загрузка
        </div>
      </PopoverContent>
    </Popover>
  );
}
