"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatNumber, cn } from "@/lib/utils";
import type { FacetOption } from "@/packages/shared/contracts/filters.schema";

interface ColumnHeaderFilterProps {
  column: string;
  header: string;
  open: boolean;
  selected: string[];
  options: FacetOption[];
  totalDistinct: number;
  search: string;
  loading?: boolean;
  error?: string;
  formatOption?: (value: string) => string;
  fontClassName: string;
  onToggle: () => void;
  onClose: () => void;
  onChange: (values: string[]) => void;
  onSearchChange: (search: string) => void;
  onClear: () => void;
}

export function ColumnHeaderFilter({
  header,
  open,
  selected,
  options,
  totalDistinct,
  search,
  loading = false,
  error,
  formatOption,
  fontClassName,
  onToggle,
  onClose,
  onChange,
  onSearchChange,
  onClear,
}: ColumnHeaderFilterProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const active = selected.length > 0;
  const truncated = totalDistinct > options.length;

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;

    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      const maxWidth = Math.min(320, window.innerWidth * 0.9);
      const used = Math.min(width, maxWidth);
      let left = rect.left;
      if (left + used > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - used - 8);
      }
      setPos({ top: rect.bottom + 4, left, width });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(trigger);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, header, selected.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const toggleValue = (value: string, disabled: boolean) => {
    if (disabled && !selected.includes(value)) return;
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const dropdown =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        className={cn("col-filter-dropdown", fontClassName)}
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          position: "fixed",
        }}
      >
        <input
          className="col-filter-search"
          placeholder={`Поиск ${header}…`}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          autoFocus
          aria-label={`Поиск ${header}`}
        />
        <div className="col-filter-list">
          {loading && options.length === 0 ? (
            <div className="col-filter-state">Загрузка…</div>
          ) : null}
          {error && options.length === 0 ? (
            <div className="col-filter-state error">{error}</div>
          ) : null}
          {!loading && !error && options.length === 0 ? (
            <div className="col-filter-state">Нет значений</div>
          ) : null}
          {options.map((option, index) => {
            const checked = selected.includes(option.value);
            const cannotSelect = Boolean(option.disabled) && !checked;
            const label = formatOption
              ? formatOption(option.value)
              : option.value;
            return (
              <label
                key={`${option.value}:${index}`}
                className={cn(
                  "col-filter-option",
                  cannotSelect && "pointer-events-none opacity-40"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={cannotSelect}
                  onChange={() => toggleValue(option.value, Boolean(option.disabled))}
                />
                <span className="col-filter-option-label">{label}</span>
                <span className="col-filter-option-count">
                  ({formatNumber(option.count)})
                </span>
              </label>
            );
          })}
          {truncated ? (
            <div className="col-filter-state">
              Показаны первые значения — уточните поиск
            </div>
          ) : null}
        </div>
        {active ? (
          <button type="button" className="col-filter-clear-btn" onClick={onClear}>
            Очистить «{header}»
          </button>
        ) : null}
      </div>,
      document.body
    );

  return (
    <div className={cn("col-header col-header-filter", active && "active")}>
      <button
        ref={triggerRef}
        type="button"
        className="col-filter-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={onToggle}
      >
        <span className="col-header-label">{header}</span>
        {active ? <span className="col-filter-count">{selected.length}</span> : null}
        <span className="col-filter-chevron" aria-hidden>
          ▾
        </span>
        {active ? (
          <span
            className="col-filter-clear"
            role="button"
            tabIndex={0}
            aria-label={`Сбросить фильтр ${header}`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onClear();
              }
            }}
          >
            ×
          </span>
        ) : null}
      </button>
      {dropdown}
    </div>
  );
}
