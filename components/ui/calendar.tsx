"use client";

import * as React from "react";
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

  return (
    <button
      {...props}
      data-day={day.date.toLocaleDateString()}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "size-8 p-0 font-normal aria-selected:opacity-100",
        modifiers.selected &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        modifiers.today && !modifiers.selected && "bg-accent text-accent-foreground",
        defaultClassNames.day,
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
        months: cn("flex flex-col gap-2", defaultClassNames.months),
        month: cn("flex flex-col gap-4", defaultClassNames.month),
        month_caption: cn(
          "flex justify-center pt-1 relative items-center w-full",
          defaultClassNames.month_caption
        ),
        caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-1 inset-x-0 justify-between px-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_next
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
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
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
