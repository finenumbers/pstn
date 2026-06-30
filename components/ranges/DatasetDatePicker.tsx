"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChangeDatesQuery } from "@/hooks/useChangeDatesQuery";
import {
  formatAsOfDisplayDate,
  getFirstDatasetLoadDate,
  maskAsOfDisplayDateInput,
  parseAsOfDisplayDate,
} from "@/packages/shared/contracts/dataset.schema";
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
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const changeDatesQuery = useChangeDatesQuery();

  useEffect(() => {
    setDraft(value ? formatAsOfDisplayDate(value) : "");
    setInvalid(false);
  }, [value]);

  useEffect(() => {
    if (!calendarOpen) return;
    const anchor = value ? parseISO(value) : new Date();
    setCalendarMonth(startOfMonth(subMonths(anchor, 1)));
  }, [calendarOpen, value]);

  const changeDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of changeDatesQuery.data?.items ?? []) {
      set.add(item.loadDate);
    }
    return set;
  }, [changeDatesQuery.data?.items]);

  const firstLoadDate = useMemo(
    () => getFirstDatasetLoadDate(changeDatesQuery.data?.items ?? []),
    [changeDatesQuery.data?.items]
  );

  const isCalendarDateDisabled = (date: Date): boolean => {
    if (date > new Date()) return true;
    if (!firstLoadDate) return true;
    return isoFromDate(date) < firstLoadDate;
  };

  const selectedDate = value ? parseISO(value) : undefined;

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setInvalid(false);
      if (value) onChange?.(null);
      return;
    }

    const iso = parseAsOfDisplayDate(trimmed, { firstLoadDate });
    if (!iso) {
      setInvalid(true);
      setDraft(value ? formatAsOfDisplayDate(value) : "");
      return;
    }

    setInvalid(false);
    if (iso !== value) {
      onChange?.(iso);
    } else {
      setDraft(formatAsOfDisplayDate(iso));
    }
  };

  return (
    <div
      className={cn(
        "inline-flex h-9 w-auto items-center rounded-md border border-input bg-background",
        invalid && "border-destructive ring-1 ring-destructive",
        disabled && "opacity-50"
      )}
    >
      <Input
        className="h-9 w-[10ch] shrink-0 border-0 bg-transparent px-2 font-mono tabular-nums shadow-none focus-visible:ring-0"
        placeholder="ДД.ММ.ГГГГ"
        size={10}
        value={draft}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        aria-label="Дата датасета"
        aria-invalid={invalid}
        onChange={(event) => {
          setInvalid(false);
          setDraft(maskAsOfDisplayDateInput(event.target.value));
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-l-none"
            disabled={disabled}
            aria-label="Открыть календарь"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            numberOfMonths={3}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={selectedDate}
            onSelect={(date) => {
              if (!date || isCalendarDateDisabled(date)) return;
              onChange?.(isoFromDate(date));
              setCalendarOpen(false);
            }}
            modifiers={{
              versionDay: (date) => changeDateSet.has(isoFromDate(date)),
            }}
            disabled={isCalendarDateDisabled}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                className="h-8 w-full text-xs"
                onClick={() => {
                  onChange?.(null);
                  setCalendarOpen(false);
                }}
              >
                Сбросить дату
              </Button>
            </div>
          )}
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            Синий фон — день версии датасета (первая загрузка или изменения).
            Ранее первой загрузки даты недоступны.
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
