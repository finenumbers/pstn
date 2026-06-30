"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();
  const mod = modifiers as Record<string, boolean | undefined>;
  const isVersionDay = Boolean(mod.versionDay);

  const versionDayStyle =
    isVersionDay && !modifiers.selected
      ? {
          backgroundColor: "var(--color-blue-100)",
          color: "var(--color-blue-950)",
        }
      : undefined;

  return (
    <button
      {...props}
      data-day={day.date.toLocaleDateString()}
      data-version-day={isVersionDay ? "true" : undefined}
      style={{ ...props.style, ...versionDayStyle }}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "size-8 p-0 font-normal aria-selected:opacity-100",
        modifiers.selected &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        modifiers.today &&
          !modifiers.selected &&
          !isVersionDay &&
          "bg-accent text-accent-foreground",
        isVersionDay &&
          !modifiers.selected &&
          "!bg-blue-100 font-medium !text-blue-950 hover:!bg-blue-200 hover:!text-blue-950",
        defaultClassNames.day_button,
        className
      )}
    />
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      locale={ru}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: cn(
          "relative flex flex-row flex-nowrap gap-4 pt-10",
          defaultClassNames.months
        ),
        month: cn("flex w-[calc(7*2rem)] flex-col gap-3", defaultClassNames.month),
        month_caption: cn(
          "flex h-8 items-center justify-center",
          defaultClassNames.month_caption
        ),
        caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),
        nav: cn(
          "pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "pointer-events-auto size-8 shrink-0 bg-background p-0 shadow-sm",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "pointer-events-auto size-8 shrink-0 bg-background p-0 shadow-sm",
          defaultClassNames.button_next
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground w-8 rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
          defaultClassNames.day
        ),
        day_button: cn(
          "size-8 p-0 font-normal aria-selected:opacity-100",
          defaultClassNames.day_button
        ),
        selected: cn(
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          defaultClassNames.selected
        ),
        today: cn("bg-accent text-accent-foreground", defaultClassNames.today),
        outside: cn(
          "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        DayButton: CalendarDayButton,
        Chevron: ({ className, orientation, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return (
            <Icon className={cn("size-4", className)} {...chevronProps} />
          );
        },
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
