"use client";

import { PhoneNumberMaskInput } from "@/components/ranges/PhoneNumberMaskInput";
import { Loader2, RefreshCw, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { SummaryResponse } from "@/packages/shared/contracts/filters.schema";

interface KpiSummaryBarProps {
  summary?: SummaryResponse;
  isLoading?: boolean;
  summaryError?: string;
  isImporting?: boolean;
  isExporting?: boolean;
  phoneNumber?: string;
  onPhoneNumberChange?: (value: string) => void;
  onLoadData: () => void;
  onExport?: () => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function KpiSummaryBar({
  summary,
  isLoading,
  summaryError,
  isImporting,
  isExporting,
  phoneNumber = "",
  onPhoneNumberChange,
  onLoadData,
  onExport,
  onResetFilters,
  hasActiveFilters = false,
}: KpiSummaryBarProps) {
  const loadedAt = summary?.loadedAt ?? null;
  const filtered = summary?.filtered;
  const global = summary?.global;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Телефонный план нумерации России
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {onResetFilters && (
            <Button
              variant="outline"
              onClick={onResetFilters}
              disabled={!hasActiveFilters || isImporting}
              title="Сбросить все фильтры и сортировку"
            >
              <FilterX className="h-4 w-4" />
              Сбросить фильтры
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onExport}
            disabled={isImporting || isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Экспорт XLSX
          </Button>
          <Button onClick={onLoadData} disabled={isImporting}>
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Загрузить данные
          </Button>
        </div>
      </div>

      {summaryError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          KPI: {summaryError}
        </div>
      )}

      {isExporting && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Формируем XLSX…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Дата загрузки данных"
          value={formatDateTime(loadedAt)}
          isLoading={isLoading}
        />
        <KpiCard
          title="Найденные диапазоны"
          isLoading={isLoading}
          compare={
            filtered && global
              ? {
                  filtered: formatNumber(filtered.rangeCount),
                  global: formatNumber(global.rangeCount),
                }
              : undefined
          }
        />
        <KpiCard
          title="Суммарная ёмкость"
          isLoading={isLoading}
          compare={
            filtered && global
              ? {
                  filtered: formatNumber(filtered.totalCapacity),
                  global: formatNumber(global.totalCapacity),
                }
              : undefined
          }
        />
        <KpiCard
          title="Уникальные операторы"
          isLoading={isLoading}
          compare={
            filtered && global
              ? {
                  filtered: formatNumber(filtered.uniqueOperators),
                  global: formatNumber(global.uniqueOperators),
                }
              : undefined
          }
        />
        <PhoneNumberSearchCard
          value={phoneNumber}
          onChange={onPhoneNumberChange}
          disabled={isImporting}
        />
      </div>
    </div>
  );
}

function PhoneNumberSearchCard({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Найти номер
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <PhoneNumberMaskInput
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </CardContent>
    </Card>
  );
}

function KpiCard({
  title,
  value,
  compare,
  isLoading,
}: {
  title: string;
  value?: string;
  compare?: { filtered: string; global: string };
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-32" />
        ) : compare ? (
          <CompareKpiValue filtered={compare.filtered} global={compare.global} />
        ) : (
          <p className="text-lg font-semibold tabular-nums">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CompareKpiValue({
  filtered,
  global,
}: {
  filtered: string;
  global: string;
}) {
  return (
    <p className="text-lg font-semibold tabular-nums">
      <span className="rounded-sm bg-yellow-200/80 px-1">{filtered}</span>
      <span className="text-muted-foreground"> / </span>
      <span>{global}</span>
    </p>
  );
}
