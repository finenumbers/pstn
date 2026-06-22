"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

export function FilterTextInput({
  value,
  onChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: FilterTextInputProps) {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn("h-7 pr-7 text-sm", className)}
      />
      {value && (
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onChange("")}
          aria-label="Очистить фильтр"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
