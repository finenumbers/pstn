"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { ActiveFilterChips } from "@/components/ranges/ActiveFilterChips";
import { ImportProgressCard } from "@/components/ranges/ImportProgressCard";
import { KpiSummaryBar } from "@/components/ranges/KpiSummaryBar";
import { RangesTable } from "@/components/ranges/RangesTable";
import { AppToast } from "@/components/ui/app-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFacetsQuery } from "@/hooks/useFacetsQuery";
import { useImportStart, useImportStatus } from "@/hooks/useImportStatus";
import { useRangesInfiniteQuery } from "@/hooks/useRangesQuery";
import { useGlobalSummaryQuery, useSummaryQuery } from "@/hooks/useSummaryQuery";
import { hasActiveFilters } from "@/lib/filters/hasActiveFilters";
import { removeArrayFilterValue } from "@/lib/filters/removeArrayFilterValue";
import {
  canResetRangesTable,
  initialTableState,
  rangesTableReducer,
  type RangesTableState,
} from "@/lib/table/rangesTableState";
import { buildFilterParams } from "@/lib/api/client";
import { EXPORT_ROW_WARN_THRESHOLD } from "@/lib/export/exportLimits";
import { mergeDebouncedTextFilters } from "@/lib/filters/mergeDebouncedTextFilters";
import {
  normalizeRangesSort,
  sortFromSingleColumn,
} from "@/lib/sort/normalizeRangesSort";
import {
  buildRangesPageSearchParams,
  parseRangesTableFromSearchParams,
} from "@/lib/url/rangesPageUrl";
import {
  DEFAULT_SORT,
  FACET_COLUMNS,
  serializeSort,
  type FiltersDTO,
  type SortableColumn,
  type SummaryResponse,
} from "@/packages/shared/contracts/filters.schema";
import { useQueryClient } from "@tanstack/react-query";

const FACET_FILTER_FIELDS: ReadonlyArray<typeof FACET_COLUMNS[number]> =
  FACET_COLUMNS;

function clearFacetSearchField(
  prev: Record<string, string>,
  field: string
): Record<string, string> {
  if (!prev[field]) return prev;
  const next = { ...prev };
  delete next[field];
  return next;
}

function readInitialTableState(): RangesTableState {
  if (typeof window === "undefined") return initialTableState;
  const parsed = parseRangesTableFromSearchParams(
    new URLSearchParams(window.location.search)
  );
  return parsed ?? initialTableState;
}

export function RangesPageContent() {
  const [state, dispatch] = useReducer(
    rangesTableReducer,
    initialTableState,
    readInitialTableState
  );
  const [facetSearch, setFacetSearch] = useState<Record<string, string>>({});
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);
  const [rangesResetKey, setRangesResetKey] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();
  const prevImportStatus = useRef<string | undefined>(undefined);
  const urlSyncedRef = useRef(false);

  const textDebounced = useDebouncedValue({
    inn: state.filters.inn,
    rangeStart: state.filters.rangeStart,
    rangeEnd: state.filters.rangeEnd,
    capacity: state.filters.capacity,
    phoneNumber: state.filters.phoneNumber,
  });

  const debouncedFacetSearch = useDebouncedValue(facetSearch, 300);

  const debouncedFilters: FiltersDTO = mergeDebouncedTextFilters(
    state.filters,
    textDebounced
  );

  const debouncedFiltersKey = JSON.stringify(debouncedFilters);
  const filtersActive = hasActiveFilters(debouncedFilters);

  const sortingForQuery = normalizeRangesSort(
    state.sorting.map((s) => ({
      id: s.id as SortableColumn,
      desc: s.desc ?? false,
    }))
  );

  const rangesQuery = useRangesInfiniteQuery({
    filters: debouncedFilters,
    sorting: sortingForQuery,
    pageSize: state.pageSize,
  });

  const rangesData =
    rangesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const totalRows = rangesQuery.data?.pages[0]?.meta.totalRows ?? 0;
  const rangesListKey = `${debouncedFiltersKey}:${serializeSort(sortingForQuery)}:${rangesResetKey}`;

  const globalSummaryQuery = useGlobalSummaryQuery();
  const filteredSummaryQuery = useSummaryQuery(debouncedFilters, {
    enabled: filtersActive,
  });
  const facetsQuery = useFacetsQuery(debouncedFilters, debouncedFacetSearch);

  const importStart = useImportStart();
  const importStatus = useImportStatus(trackedJobId);

  const trackedImport = importStatus.data?.jobId === trackedJobId
    ? importStatus.data
    : undefined;

  const importJobActive =
    Boolean(trackedImport?.jobId) &&
    (trackedImport?.status === "running" ||
      trackedImport?.status === "pending");

  const isImporting = importJobActive || importStart.isPending;

  const showImportProgress =
    Boolean(trackedJobId) &&
    Boolean(trackedImport?.progress) &&
    dismissedJobId !== trackedJobId &&
    (trackedImport?.status === "pending" ||
      trackedImport?.status === "running" ||
      trackedImport?.status === "completed" ||
      trackedImport?.status === "failed");

  const mergedSummary: SummaryResponse | undefined =
    globalSummaryQuery.data?.global
      ? {
          loadedAt:
            globalSummaryQuery.data.loadedAt ??
            (filtersActive ? filteredSummaryQuery.data?.loadedAt : null) ??
            null,
          global: globalSummaryQuery.data.global,
          filtered:
            filtersActive && filteredSummaryQuery.data
              ? filteredSummaryQuery.data.filtered
              : globalSummaryQuery.data.global,
        }
      : filteredSummaryQuery.data;

  const summaryLoading =
    (globalSummaryQuery.isLoading && !globalSummaryQuery.data) ||
    (filtersActive &&
      filteredSummaryQuery.isLoading &&
      !filteredSummaryQuery.data);

  const summaryError =
    filtersActive && filteredSummaryQuery.isError
      ? filteredSummaryQuery.error?.message ?? "Ошибка загрузки KPI"
      : globalSummaryQuery.isError
        ? globalSummaryQuery.error?.message ?? "Ошибка загрузки KPI"
        : undefined;

  useEffect(() => {
    urlSyncedRef.current = true;
  }, []);

  const sortQueryKey = serializeSort(sortingForQuery);

  useEffect(() => {
    if (!urlSyncedRef.current) return;
    const params = buildRangesPageSearchParams(
      debouncedFilters,
      sortingForQuery
    );
    const qs = params.toString();
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    const current = window.location.pathname + window.location.search;
    if (current !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [debouncedFilters, sortQueryKey, sortingForQuery]);

  useEffect(() => {
    const data = importStatus.data;
    if (!data?.jobId || trackedJobId) return;
    if (data.status === "pending" || data.status === "running") {
      setTrackedJobId(data.jobId);
    }
  }, [importStatus.data, trackedJobId]);

  useEffect(() => {
    const data = trackedImport;
    if (!data?.jobId || data.jobId !== trackedJobId) return;

    const status = data.status;
    if (
      status &&
      status !== prevImportStatus.current &&
      status === "completed"
    ) {
      queryClient.invalidateQueries({ queryKey: ["ranges"] });
      queryClient.invalidateQueries({ queryKey: ["facets"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    }

    prevImportStatus.current = status;
  }, [trackedImport, trackedJobId, queryClient]);

  useEffect(() => {
    if (trackedImport?.status !== "completed") return;
    if (trackedImport.jobId !== trackedJobId) return;

    const timer = window.setTimeout(() => {
      setDismissedJobId(trackedJobId);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [trackedImport?.status, trackedImport?.jobId, trackedJobId]);

  useEffect(() => {
    if (!facetsQuery.isSuccess || !facetsQuery.data) return;
    if (
      facetsQuery.isFetching ||
      facetsQuery.isPlaceholderData ||
      facetsQuery.isPending
    ) {
      return;
    }

    const facetsData = facetsQuery.data;
    const nextFilters = { ...state.filters };
    let changed = false;

    for (const column of FACET_COLUMNS) {
      const facetOptions = facetsData.facets[column]?.options ?? [];
      const current = nextFilters[column];
      if (current.length === 0) continue;

      const filtered = current.filter((v) => {
        const option = facetOptions.find((o) => o.value === v);
        if (!option) return true;
        return option.count > 0;
      });
      if (filtered.length !== current.length) {
        nextFilters[column] = filtered;
        changed = true;
      }
    }

    if (changed) {
      dispatch({ type: "SET_FILTERS", filters: nextFilters });
    }
  }, [
    debouncedFiltersKey,
    state.filters,
    facetsQuery.data,
    facetsQuery.isSuccess,
    facetsQuery.isFetching,
    facetsQuery.isPlaceholderData,
    facetsQuery.isPending,
  ]);

  const handleLoadData = async () => {
    const result = await importStart.mutateAsync();
    setDismissedJobId(null);
    setTrackedJobId(result.jobId);
  };

  const handleDismissImportProgress = () => {
    if (trackedJobId) {
      setDismissedJobId(trackedJobId);
    }
  };

  const handleFilterChange = (
    field: keyof FiltersDTO,
    value: FiltersDTO[keyof FiltersDTO]
  ) => {
    dispatch({ type: "SET_FILTER", field, value });
    if (
      FACET_FILTER_FIELDS.includes(field as typeof FACET_FILTER_FIELDS[number]) &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      setFacetSearch((prev) => clearFacetSearchField(prev, field));
    }
  };

  const handleRemoveFilter = (field: keyof FiltersDTO, value?: string) => {
    const current = state.filters[field];
    if (Array.isArray(current)) {
      const next =
        value !== undefined ? removeArrayFilterValue(current, value) : [];
      handleFilterChange(field, next as FiltersDTO[keyof FiltersDTO]);
    } else if (!Array.isArray(current)) {
      handleFilterChange(field, "" as FiltersDTO[keyof FiltersDTO]);
    }
  };

  const handleSortingChange = (sorting: SortingState) => {
    const primary =
      sorting.length > 0
        ? {
            id: sorting[0].id as SortableColumn,
            desc: sorting[0].desc ?? false,
          }
        : DEFAULT_SORT[0];

    dispatch({
      type: "SET_SORTING",
      sorting: sortFromSingleColumn(primary.id, primary.desc),
    });
  };

  const handleResetAll = () => {
    dispatch({ type: "RESET_ALL" });
    setFacetSearch({});
    setRangesResetKey((key) => key + 1);
    queryClient.removeQueries({ queryKey: ["ranges"] });
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleExport = async () => {
    const exportCount = filtersActive
      ? mergedSummary?.filtered.rangeCount
      : mergedSummary?.global.rangeCount;

    if (
      exportCount != null &&
      exportCount > EXPORT_ROW_WARN_THRESHOLD &&
      !window.confirm(
        `Экспорт ${exportCount.toLocaleString("ru-RU")} строк может занять несколько минут. Продолжить?`
      )
    ) {
      return;
    }

    setIsExporting(true);
    try {
      const params = buildFilterParams(debouncedFilters);
      const response = await fetch(`/api/export/ranges?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ranges-export.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      setToastMessage("Экспорт XLSX завершён");
    } catch (error) {
      setToastMessage(
        error instanceof Error ? error.message : "Ошибка экспорта XLSX"
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFacetSearchChange = useCallback(
    (column: string, search: string) => {
      setFacetSearch((prev) => {
        if (!search.trim()) {
          return clearFacetSearchField(prev, column);
        }
        if (prev[column] === search) return prev;
        return { ...prev, [column]: search };
      });
    },
    []
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <KpiSummaryBar
        summary={mergedSummary}
        isLoading={summaryLoading}
        summaryError={summaryError}
        isImporting={isImporting}
        isExporting={isExporting}
        phoneNumber={state.filters.phoneNumber}
        onPhoneNumberChange={(value) =>
          handleFilterChange("phoneNumber", value)
        }
        onLoadData={handleLoadData}
        onExport={handleExport}
        onResetFilters={handleResetAll}
        hasActiveFilters={canResetRangesTable(
          state.filters,
          rangesQuery.data?.pages.length ?? 0
        )}
      />

      {showImportProgress && trackedImport && (
        <ImportProgressCard
          status={trackedImport}
          onDismiss={handleDismissImportProgress}
          onRetry={handleLoadData}
        />
      )}

      <ActiveFilterChips
        filters={state.filters}
        onRemove={handleRemoveFilter}
      />

      <RangesTable
        listKey={rangesListKey}
        data={rangesData}
        totalRows={totalRows}
        sorting={state.sorting}
        filters={state.filters}
        facets={facetsQuery.data}
        facetsLoading={facetsQuery.isLoading}
        facetSearch={facetSearch}
        onFacetSearchChange={handleFacetSearchChange}
        onSortingChange={handleSortingChange}
        onFilterChange={handleFilterChange}
        hasMore={rangesQuery.hasNextPage ?? false}
        onLoadMore={() => rangesQuery.fetchNextPage()}
        isLoading={rangesQuery.isLoading}
        isFetching={rangesQuery.isFetching && !rangesQuery.isFetchingNextPage}
        isFetchingNextPage={rangesQuery.isFetchingNextPage}
        errorMessage={
          rangesQuery.isError
            ? rangesQuery.error?.message ?? "Не удалось загрузить данные"
            : undefined
        }
        facetsError={
          facetsQuery.isError
            ? facetsQuery.error?.message ?? "Не удалось загрузить фильтры"
            : undefined
        }
      />

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </div>
  );
}
