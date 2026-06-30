"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { parseISO, startOfMonth, subMonths } from "date-fns";
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

/** Local calendar date as YYYY-MM-DD (matches snapshot loadDate keys). */
function isoFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Input width for full DD.MM.YYYY (e.g. 30.06.2026) in mono. */
const DATE_INPUT_CLASS = "h-9 w-[7rem] shrink-0 border-0 bg-transparent px-2 font-mono text-sm tabular-nums shadow-none focus-visible:ring-0";

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
        className={DATE_INPUT_CLASS}
        placeholder="ДД.ММ.ГГГГ"
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
            modifiersClassNames={{
              versionDay:
                "[&>button:not([disabled])]:!bg-blue-100 [&>button:not([disabled])]:font-medium [&>button:not([disabled])]:!text-blue-950 [&>button:not([disabled])]:hover:!bg-blue-200",
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
