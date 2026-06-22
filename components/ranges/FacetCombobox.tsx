"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber, cn } from "@/lib/utils";
import type { FacetOption } from "@/packages/shared/contracts/filters.schema";

interface FacetComboboxProps {
  label: string;
  values: string[];
  search: string;
  options: FacetOption[];
  onChange: (values: string[]) => void;
  onSearchChange?: (search: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  compact?: boolean;
  formatOption?: (value: string) => string;
}

export function FacetCombobox({
  label,
  values,
  search,
  options,
  onChange,
  onSearchChange,
  isLoading,
  placeholder = "Выберите...",
  formatOption,
}: FacetComboboxProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const clearSearch = () => onSearchChange?.("");

  const clearAll = () => {
    onChange([]);
    clearSearch();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      clearSearch();
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 min-w-0 justify-between font-bold w-full",
              values.length > 0 && "border-primary/50 bg-primary/5"
            )}
            aria-label={label}
          >
            <span className="truncate text-left">
              {values.length > 0
                ? `${values.length} выбрано`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Поиск ${label}...`}
              value={search}
              onValueChange={onSearchChange}
            />
            <CommandList>
              {isLoading && options.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Загрузка...
                </div>
              ) : (
                <>
                  <CommandEmpty>Ничего не найдено</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value || "__empty__"}
                        value={option.value}
                        disabled={option.disabled && !option.selected}
                        onSelect={() => toggle(option.value)}
                        className={cn(
                          option.disabled &&
                            !option.selected &&
                            "opacity-40"
                        )}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            values.includes(option.value)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate flex-1">
                          {formatOption
                            ? formatOption(option.value)
                            : option.value}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatNumber(option.count)})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
            {values.length > 0 && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={clearAll}
                >
                  Очистить «{label}»
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {values.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={clearAll}
          aria-label={`Сбросить фильтр ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
