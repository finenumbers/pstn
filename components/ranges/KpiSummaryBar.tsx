"use client";

import { PhoneNumberMaskInput } from "@/components/ranges/PhoneNumberMaskInput";
import { ExternalApiHelpDialog } from "@/components/ranges/ExternalApiHelpDialog";
import { DatasetDatePicker } from "@/components/ranges/DatasetDatePicker";
import { DbSizeInfo } from "@/components/ranges/DbSizeInfo";
import {
  DatasetSelector,
} from "@/components/ranges/DatasetSelector";
import { ToolbarOutlineButton } from "@/components/ranges/ToolbarOutlineButton";
import { FileSpreadsheet, Loader2, RefreshCw, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { SummaryResponse } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef as SharedDatasetRef } from "@/packages/shared/contracts/dataset.schema";

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
  selectedDataset?: SharedDatasetRef;
  onDatasetChange?: (dataset: SharedDatasetRef) => void;
  selectedAsOf?: string | null;
  onAsOfChange?: (value: string | null) => void;
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
  selectedDataset = { kind: "current" },
  onDatasetChange,
  selectedAsOf = null,
  onAsOfChange,
}: KpiSummaryBarProps) {
  const filtered = summary?.filtered;
  const global = summary?.global;
  const isEmptyDataset =
    !isLoading && global != null && global.rangeCount === 0;
  const isUvrUnbound =
    !isLoading &&
    !isEmptyDataset &&
    summary?.uvrBinding?.registryOperators === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            PSTN Analytics
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <DatasetDatePicker
            value={selectedAsOf}
            onChange={onAsOfChange}
            disabled={isImporting}
          />
          {onDatasetChange && (
            <DatasetSelector
              value={selectedDataset}
              onChange={onDatasetChange}
              disabled={isImporting}
            />
          )}
          <DbSizeInfo />
          <ExternalApiHelpDialog
            phoneMask={phoneNumber}
            dataset={selectedDataset}
            disabled={isImporting}
          />
          <ToolbarOutlineButton
            onClick={onExport}
            disabled={isImporting || isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
            )}
            XLSX
          </ToolbarOutlineButton>
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

      {isEmptyDataset && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Данные ещё не загружены. Нажмите «Загрузить данные» для полной
          загрузки всех четырёх CSV с opendata.digital.gov.ru. При сбоях или
          некорректных данных — повторите загрузку тем же способом.
        </div>
      )}

      {isUvrUnbound && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Колонка «УВр Антифрод» пустая: реестр OPR не загружен. После{" "}
          <strong>Pull and redeploy</strong> образ с{" "}
          <code className="rounded bg-amber-100 px-1">data/opr/</code> должен
          подтянуться автоматически при старте. Проверьте логи{" "}
          <code className="rounded bg-amber-100 px-1">pstn_app</code> («Loaded …
          OPR operators»).
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
          title="Операторы связи"
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
        <KpiCard
          title="Регионы / Территории ГАР"
          isLoading={isLoading}
          compare={
            filtered && global
              ? {
                  filtered: `${formatNumber(filtered.uniqueRegions)} (${formatNumber(filtered.uniqueGarTerritories)})`,
                  global: `${formatNumber(global.uniqueRegions)} (${formatNumber(global.uniqueGarTerritories)})`,
                }
              : undefined
          }
        />
        <KpiCard
          title="Суммарная ёмкость"
          isLoading={
            isLoading ||
            Boolean(filtered?.totalCapacityPending && filtered && global)
          }
          compare={
            filtered && global && !filtered.totalCapacityPending
              ? {
                  filtered: formatNumber(filtered.totalCapacity),
                  global: formatNumber(global.totalCapacity),
                }
              : filtered && global && filtered.totalCapacityPending
                ? {
                    filtered: "…",
                    global: formatNumber(global.totalCapacity),
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
          <p className="text-base font-semibold tabular-nums">{value ?? "—"}</p>
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
    <p className="text-base font-semibold tabular-nums">
      <span className="rounded-sm bg-yellow-200/80 px-1">{filtered}</span>
      <span className="text-muted-foreground"> / </span>
      <span>{global}</span>
    </p>
  );
}
