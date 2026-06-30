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
import { buildFilterParams, mapFetchResponseError } from "@/lib/api/client";
import {
  getErrorUserMessage,
  isApiErrorCode,
} from "@/lib/api/apiClientError";
import { EXPORT_ROW_WARN_THRESHOLD } from "@/lib/export/exportLimits";
import { mergeDebouncedTextFilters } from "@/lib/filters/mergeDebouncedTextFilters";
import {
  normalizeRangesSort,
  sortFromSingleColumn,
} from "@/lib/sort/normalizeRangesSort";
import {
  buildRangesPageSearchParams,
  parseAsOfFromSearchParams,
  parseRangesTableFromSearchParams,
  parseDatasetFromSearchParams,
} from "@/lib/url/rangesPageUrl";
import { HistoricalDatasetBanner } from "@/components/ranges/DbSizeInfo";
import {
  serializeDatasetParam,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import {
  DEFAULT_SORT,
  FACET_COLUMNS,
  serializeSort,
  type FiltersDTO,
  type SortableColumn,
  type SummaryResponse,
} from "@/packages/shared/contracts/filters.schema";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";

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
  const params = new URLSearchParams(window.location.search);
  const parsed = parseRangesTableFromSearchParams(params);
  return parsed ?? initialTableState;
}

function readInitialDataset(): DatasetRef {
  if (typeof window === "undefined") return { kind: "current" };
  return parseDatasetFromSearchParams(
    new URLSearchParams(window.location.search)
  );
}

function readInitialAsOf(): string | null {
  if (typeof window === "undefined") return null;
  return parseAsOfFromSearchParams(new URLSearchParams(window.location.search));
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
  const [selectedDataset, setSelectedDataset] = useState<DatasetRef>(
    readInitialDataset
  );
  const [selectedAsOf, setSelectedAsOf] = useState<string | null>(readInitialAsOf);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">(
    "success"
  );
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();
  const prevImportStatus = useRef<string | undefined>(undefined);
  const urlSyncedRef = useRef(false);
  const urlHistoryInitializedRef = useRef(false);

  const otherTextDebounced = useDebouncedValue(
    {
      rangeStart: state.filters.rangeStart,
      rangeEnd: state.filters.rangeEnd,
      capacity: state.filters.capacity,
    },
    300
  );
  const phoneDebounced = useDebouncedValue(state.filters.phoneNumber, 500);

  const textDebounced = {
    ...otherTextDebounced,
    phoneNumber: phoneDebounced,
  };

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

  const effectiveAsOf =
    selectedDataset.kind === "current" ? selectedAsOf : null;

  const rangesQuery = useRangesInfiniteQuery({
    filters: debouncedFilters,
    sorting: sortingForQuery,
    pageSize: state.pageSize,
    dataset: selectedDataset,
    asOf: effectiveAsOf,
  });

  const isDiffView = selectedDataset.kind === "diff";
  const isHistoricalView =
    selectedDataset.kind === "current" && Boolean(effectiveAsOf);
  const datasetParam = serializeDatasetParam(selectedDataset);

  const rangesData =
    rangesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const totalRows = rangesQuery.data?.pages[0]?.meta.totalRows ?? 0;
  const rangesListKey = `${datasetParam}:${effectiveAsOf ?? ""}:${debouncedFiltersKey}:${serializeSort(sortingForQuery)}:${rangesResetKey}`;

  const globalSummaryQuery = useGlobalSummaryQuery(selectedDataset, effectiveAsOf);
  const rangesReadyForSecondaryQueries =
    !filtersActive || rangesQuery.isFetched || rangesQuery.isSuccess;
  const filteredSummaryQuery = useSummaryQuery(debouncedFilters, {
    enabled: filtersActive && rangesReadyForSecondaryQueries,
    dataset: selectedDataset,
    asOf: effectiveAsOf,
  });
  const facetsQuery = useFacetsQuery(debouncedFilters, debouncedFacetSearch, {
    enabled: rangesReadyForSecondaryQueries,
    dataset: selectedDataset,
    asOf: effectiveAsOf,
  });

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
      trackedImport?.status === "failed" ||
      trackedImport?.status === "skipped");

  const mergedSummary: SummaryResponse | undefined =
    globalSummaryQuery.data?.global
      ? {
          loadedAt: globalSummaryQuery.data.loadedAt ?? null,
          global: globalSummaryQuery.data.global,
          filtered:
            filtersActive && filteredSummaryQuery.data
              ? filteredSummaryQuery.data.filtered
              : globalSummaryQuery.data.global,
          uvrBinding:
            globalSummaryQuery.data.uvrBinding ??
            filteredSummaryQuery.data?.uvrBinding ?? {
              registryOperators: 0,
              matchedDistinctInns: 0,
            },
        }
      : filteredSummaryQuery.data;

  const summaryLoading =
    (globalSummaryQuery.isLoading && !globalSummaryQuery.data) ||
    (filtersActive &&
      rangesReadyForSecondaryQueries &&
      filteredSummaryQuery.isLoading &&
      !filteredSummaryQuery.data);

  const summaryError =
    filtersActive && filteredSummaryQuery.isError
      ? getErrorUserMessage(
          filteredSummaryQuery.error,
          "Ошибка загрузки KPI"
        )
      : globalSummaryQuery.isError
        ? getErrorUserMessage(globalSummaryQuery.error, "Ошибка загрузки KPI")
        : undefined;

  useEffect(() => {
    urlSyncedRef.current = true;
  }, []);

  const sortQueryKey = serializeSort(sortingForQuery);

  useEffect(() => {
    if (!urlSyncedRef.current) return;
    const params = buildRangesPageSearchParams(
      debouncedFilters,
      sortingForQuery,
      selectedDataset,
      effectiveAsOf
    );
    const qs = params.toString();
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    const current = window.location.pathname + window.location.search;
    if (current !== next) {
      if (urlHistoryInitializedRef.current) {
        window.history.pushState(null, "", next);
      } else {
        window.history.replaceState(null, "", next);
        urlHistoryInitializedRef.current = true;
      }
    }
  }, [debouncedFilters, sortQueryKey, sortingForQuery, selectedDataset, effectiveAsOf]);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRangesTableFromSearchParams(
        new URLSearchParams(window.location.search)
      );
      const dataset = parseDatasetFromSearchParams(
        new URLSearchParams(window.location.search)
      );
      const asOf = parseAsOfFromSearchParams(
        new URLSearchParams(window.location.search)
      );
      if (parsed) {
        dispatch({ type: "SET_FILTERS", filters: parsed.filters });
        dispatch({ type: "SET_SORTING", sorting: parsed.sorting });
      } else {
        dispatch({ type: "RESET_ALL" });
      }
      setSelectedDataset(dataset);
      setSelectedAsOf(asOf);
      setRangesResetKey((key) => key + 1);
      queryClient.removeQueries({ queryKey: ["ranges"] });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [queryClient]);

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
      (status === "completed" || status === "skipped")
    ) {
      queryClient.invalidateQueries({ queryKey: ["ranges"] });
      queryClient.invalidateQueries({ queryKey: ["facets"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.changeDates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.storage() });
    }

    prevImportStatus.current = status;
  }, [trackedImport, trackedJobId, queryClient]);

  useEffect(() => {
    if (trackedImport?.status !== "completed" && trackedImport?.status !== "skipped") return;
    if (trackedImport.jobId !== trackedJobId) return;

    const timer = window.setTimeout(() => {
      setDismissedJobId(trackedJobId);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [trackedImport?.status, trackedImport?.jobId, trackedJobId]);

  useEffect(() => {
    if (selectedDataset.kind !== "diff") return;

    const datasetError =
      rangesQuery.error ??
      globalSummaryQuery.error ??
      (filtersActive ? filteredSummaryQuery.error : undefined);
    if (!datasetError) return;

    if (!isApiErrorCode(datasetError, "DATASET_NOT_FOUND")) return;

    setSelectedDataset({ kind: "current" });
    setRangesResetKey((key) => key + 1);
    setToastVariant("success");
    setToastMessage("Снимок расхождений не найден, показан текущий датасет");
    queryClient.removeQueries({ queryKey: ["ranges"] });

    const params = buildRangesPageSearchParams(
      debouncedFilters,
      sortingForQuery,
      { kind: "current" }
    );
    const qs = params.toString();
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, [
    selectedDataset.kind,
    rangesQuery.error,
    globalSummaryQuery.error,
    filteredSummaryQuery.error,
    filtersActive,
    debouncedFilters,
    sortingForQuery,
    queryClient,
  ]);

  const handleLoadData = async () => {
    try {
      const result = await importStart.mutateAsync();
      setDismissedJobId(null);
      setTrackedJobId(result.jobId);
    } catch (error) {
      setToastVariant("error");
      setToastMessage(
        getErrorUserMessage(error, "Не удалось запустить загрузку данных.")
      );
    }
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
    setSelectedDataset({ kind: "current" });
    setSelectedAsOf(null);
    setRangesResetKey((key) => key + 1);
    queryClient.removeQueries({ queryKey: ["ranges"] });
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleAsOfChange = (asOf: string | null) => {
    setSelectedAsOf(asOf);
    if (selectedDataset.kind !== "current") {
      setSelectedDataset({ kind: "current" });
    }
    setRangesResetKey((key) => key + 1);
    queryClient.removeQueries({ queryKey: ["ranges"] });
  };

  const handleDatasetChange = (dataset: DatasetRef) => {
    setSelectedDataset(dataset);
    setRangesResetKey((key) => key + 1);
    queryClient.removeQueries({ queryKey: ["ranges"] });
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
      params.set("dataset", datasetParam);
      if (effectiveAsOf) {
        params.set("asOf", effectiveAsOf);
      }
      const response = await fetch(`/api/export/ranges?${params.toString()}`);
      if (!response.ok) {
        const mapped = await mapFetchResponseError(response);
        throw new Error(mapped.userMessage);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ranges-export.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      setToastVariant("success");
      setToastMessage("Экспорт XLSX завершён");
    } catch (error) {
      setToastVariant("error");
      setToastMessage(
        getErrorUserMessage(error, "Ошибка экспорта XLSX")
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
        hasActiveFilters={
          canResetRangesTable(
            debouncedFilters,
            rangesQuery.data?.pages.length ?? 0,
            state.sorting
          ) ||
          selectedDataset.kind !== "current" ||
          Boolean(effectiveAsOf)
        }
        selectedDataset={selectedDataset}
        onDatasetChange={handleDatasetChange}
        selectedAsOf={effectiveAsOf}
        onAsOfChange={handleAsOfChange}
      />

      {isHistoricalView && effectiveAsOf && (
        <HistoricalDatasetBanner
          asOf={effectiveAsOf}
          versionLoadDate={mergedSummary?.loadedAt}
        />
      )}

      {importStatus.isError && trackedJobId && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          Не удалось получить статус загрузки.{" "}
          {getErrorUserMessage(
            importStatus.error,
            "Проверьте соединение и обновите страницу."
          )}
        </div>
      )}

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
          rangesQuery.isError && rangesData.length === 0
            ? getErrorUserMessage(
                rangesQuery.error,
                "Не удалось загрузить данные"
              )
            : undefined
        }
        loadMoreError={
          rangesQuery.isFetchNextPageError
            ? getErrorUserMessage(
                rangesQuery.error,
                "Не удалось загрузить следующую страницу"
              )
            : undefined
        }
        facetsError={
          facetsQuery.isError
            ? getErrorUserMessage(
                facetsQuery.error,
                "Не удалось загрузить фильтры"
              )
            : undefined
        }
        isDiffView={isDiffView}
      />

      <AppToast
        message={toastMessage}
        variant={toastVariant}
        onDismiss={() => setToastMessage(null)}
      />
    </div>
  );
}
