"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SortingState } from "@tanstack/react-table";
import { ColumnHeaderFilter } from "@/components/ranges/ColumnHeaderFilter";
import { DiffChangeDetailDialog } from "@/components/ranges/DiffChangeDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dadataPartyUrl } from "@/lib/dadata/partyUrl";
import { yandexMapsUrl } from "@/lib/dadata/yandexMapsUrl";
import {
  DIFF_CHANGE_STATUS_LABELS,
  DIFF_CHANGED_FIELD_LABELS,
  formatChangeStatusLabel,
  formatChangedFieldsLabel,
} from "@/lib/diff/diffChangedFields";
import { ibmPlexSans } from "@/lib/fonts/ibmPlexSans";
import {
  numberingGapShadowClass,
  effectiveAbcRangeGapMarkers,
} from "@/lib/table/abcRangeGapDisplay";
import { longestColumnTexts } from "@/lib/table/columnContentWidth";
import { getRangeRowHighlightClass } from "@/lib/table/rangeRowHighlight";
import {
  isGapCompatibleSort,
  sortFromSingleColumn,
} from "@/lib/sort/normalizeRangesSort";
import { cn, formatNumber, formatRangeSegment } from "@/lib/utils";
import {
  type FacetsResponse,
  type FiltersDTO,
  type NumberRangeRow,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";

interface RangesTableProps {
  listKey: string;
  data: NumberRangeRow[];
  totalRows: number;
  sorting: SortingState;
  filters: FiltersDTO;
  facets?: FacetsResponse;
  facetsLoading?: boolean;
  facetSearch: Record<string, string>;
  onFacetSearchChange: (column: string, search: string) => void;
  onSortingChange: (sorting: SortingState) => void;
  onFilterChange: (field: keyof FiltersDTO, value: FiltersDTO[keyof FiltersDTO]) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  errorMessage?: string;
  loadMoreError?: string;
  facetsError?: string;
  isDiffView?: boolean;
}

const COLUMN_ORDER = [
  "abc",
  "rangeStart",
  "rangeEnd",
  "capacity",
  "operator",
  "garTerritory",
  "legalAddress",
  "inn",
  "uvrAntifraud",
] as const;

const DIFF_COLUMN_ORDER = [
  ...COLUMN_ORDER,
  "changeStatus",
  "changedFields",
] as const;

type DiffTableColumnId = (typeof DIFF_COLUMN_ORDER)[number];
type TableColumnId = (typeof COLUMN_ORDER)[number];

const COLUMN_LABELS: Record<TableColumnId, string> = {
  abc: "ABC",
  rangeStart: "Начало",
  rangeEnd: "Конец",
  capacity: "Емкость",
  operator: "Оператор связи",
  garTerritory: "Территория ГАР",
  legalAddress: "Юридический адрес",
  inn: "ИНН",
  uvrAntifraud: "УВр Антифрод",
};

const DIFF_COLUMN_LABELS: Record<DiffTableColumnId, string> = {
  ...COLUMN_LABELS,
  changeStatus: "Статус",
  changedFields: "Изменения",
};

const BOLD_COLUMNS = new Set<string>(["rangeStart", "rangeEnd"]);
const SORT_COLUMNS = new Set<SortableColumn>(["rangeStart", "rangeEnd", "capacity"]);
/** py-0.5 + text-xs line + border, before measureElement corrects it. */
const ESTIMATED_ROW_HEIGHT = 21;

const HEAD_CLASS =
  "sticky top-0 z-20 h-7 bg-background px-2 text-left align-middle text-xs font-medium whitespace-nowrap text-foreground shadow-[inset_-1px_-1px_0_0_var(--color-border)] last:shadow-[inset_0_-1px_0_0_var(--color-border)]";

const CELL_CLASS =
  "border-b border-r px-2 py-0.5 align-middle text-xs whitespace-nowrap last:border-r-0";

function facetValues(filters: FiltersDTO, columnId: string): string[] {
  switch (columnId) {
    case "abc":
      return filters.abc;
    case "operator":
      return filters.operator;
    case "garTerritory":
      return filters.garTerritory;
    case "inn":
      return filters.inn;
    case "uvrAntifraud":
      return filters.uvrAntifraud;
    case "changeStatus":
      return filters.changeStatus;
    case "changedFields":
      return filters.changedFields;
    default:
      return [];
  }
}

function isFacetColumn(
  columnId: string
): columnId is
  | "abc"
  | "operator"
  | "garTerritory"
  | "inn"
  | "uvrAntifraud"
  | "changeStatus"
  | "changedFields" {
  return (
    columnId === "abc" ||
    columnId === "operator" ||
    columnId === "garTerritory" ||
    columnId === "inn" ||
    columnId === "uvrAntifraud" ||
    columnId === "changeStatus" ||
    columnId === "changedFields"
  );
}

function linkClass(row: NumberRangeRow, isDiffView: boolean): string {
  if (isDiffView && (row.changeType === "added" || row.changeType === "removed")) {
    return "text-inherit underline-offset-2 hover:underline";
  }
  return "text-foreground underline-offset-2 hover:underline";
}

function renderLinkedText(text: string, href: string | null, className: string): ReactNode {
  if (!href) return text;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {text}
    </a>
  );
}

function renderLegalAddressCell(row: NumberRangeRow, isDiffView: boolean): ReactNode {
  const display = row.legalAddress && row.legalAddress.length > 0 ? row.legalAddress : "—";
  if (display === "—") return display;
  return renderLinkedText(display, yandexMapsUrl(row.legalAddress), linkClass(row, isDiffView));
}

function renderInnCell(row: NumberRangeRow, isDiffView: boolean): ReactNode {
  const display = row.inn && row.inn.length > 0 ? row.inn : "—";
  if (display === "—") return display;
  return renderLinkedText(display, dadataPartyUrl(row.inn), linkClass(row, isDiffView));
}

function ColumnWidthProbe({
  texts,
  fontClassName,
  onMeasure,
}: {
  texts: Record<string, string>;
  fontClassName: string;
  onMeasure: (widths: Record<string, number>) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onMeasureRef = useRef(onMeasure);
  onMeasureRef.current = onMeasure;
  const signature = JSON.stringify(texts);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !hostRef.current) return;
      const next: Record<string, number> = {};
      hostRef.current.querySelectorAll<HTMLElement>("[data-col]").forEach((el) => {
        const id = el.dataset.col;
        if (!id) return;
        next[id] = Math.ceil(el.getBoundingClientRect().width) + 1;
      });
      onMeasureRef.current(next);
    };
    measure();
    const ready = document.fonts?.ready;
    if (ready) void ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [signature, fontClassName]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(fontClassName, "pointer-events-none fixed top-0 left-0 -z-10 opacity-0")}
    >
      {Object.entries(texts).map(([id, text]) => (
        <span
          key={id}
          data-col={id}
          className={cn(
            "inline-block px-2 text-xs whitespace-nowrap",
            BOLD_COLUMNS.has(id) && "font-bold"
          )}
        >
          {text || " "}
        </span>
      ))}
    </div>
  );
}

export function RangesTable({
  listKey,
  data,
  totalRows,
  sorting,
  filters,
  facets,
  facetsLoading,
  facetSearch,
  onFacetSearchChange,
  onSortingChange,
  onFilterChange,
  hasMore = false,
  onLoadMore,
  isLoading,
  isFetching,
  isFetchingNextPage,
  errorMessage,
  loadMoreError,
  facetsError,
  isDiffView = false,
}: RangesTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [detailRow, setDetailRow] = useState<NumberRangeRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [minWidths, setMinWidths] = useState<Record<string, number>>({});
  const openColumnRef = useRef<string | null>(null);
  const onFacetSearchChangeRef = useRef(onFacetSearchChange);
  openColumnRef.current = openColumn;
  onFacetSearchChangeRef.current = onFacetSearchChange;

  const columnOrder = isDiffView ? DIFF_COLUMN_ORDER : COLUMN_ORDER;
  const headers: Record<string, string> = isDiffView
    ? DIFF_COLUMN_LABELS
    : COLUMN_LABELS;

  const longestTexts = useMemo(
    () => longestColumnTexts(columnOrder, headers, data),
    [columnOrder, headers, data]
  );

  const onMeasure = useCallback((next: Record<string, number>) => {
    setMinWidths((prev) => {
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(prev).length &&
        keys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const current = openColumnRef.current;
    openColumnRef.current = null;
    setOpenColumn(null);
    if (current) onFacetSearchChangeRef.current(current, "");
  }, [listKey]);

  const closeColumn = useCallback((column: string) => {
    onFacetSearchChangeRef.current(column, "");
    setOpenColumn((current) => (current === column ? null : current));
  }, []);

  const toggleColumn = useCallback((column: string) => {
    const current = openColumnRef.current;
    if (current === column) {
      onFacetSearchChangeRef.current(column, "");
      openColumnRef.current = null;
      setOpenColumn(null);
      return;
    }
    if (current) onFacetSearchChangeRef.current(current, "");
    openColumnRef.current = column;
    setOpenColumn(column);
  }, []);

  const clearColumn = useCallback(
    (column: string) => {
      if (!isFacetColumn(column)) return;
      onFilterChange(column, []);
      onFacetSearchChange(column, "");
    },
    [onFilterChange, onFacetSearchChange]
  );

  const showGapMarkers =
    !isDiffView &&
    isGapCompatibleSort(
      sorting.map((item) => ({
        id: item.id as SortableColumn,
        desc: item.desc ?? false,
      }))
    );

  const rowVirtualizer = useVirtualizer({
    count: isLoading || errorMessage || data.length === 0 ? 0 : data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [listKey]);

  const lastVirtualIndex = virtualRows[virtualRows.length - 1]?.index;

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onLoadMore || !hasMore || isFetchingNextPage) return;
    const items = rowVirtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (last && last.index >= data.length - 8) {
      onLoadMore();
    }
  }, [
    virtualRows.length,
    lastVirtualIndex,
    data.length,
    onLoadMore,
    hasMore,
    isFetchingNextPage,
    rowVirtualizer,
  ]);

  const toggleSort = (columnId: SortableColumn) => {
    const existing = sorting.find((item) => item.id === columnId);
    const isPrimary = sorting[0]?.id === columnId;

    if (!existing || !isPrimary) {
      onSortingChange(sortFromSingleColumn(columnId, false));
      return;
    }
    if (!existing.desc) {
      onSortingChange(sortFromSingleColumn(columnId, true));
      return;
    }
    onSortingChange(sortFromSingleColumn(columnId, false));
  };

  const renderSortHeader = (columnId: SortableColumn) => {
    const active = sorting.find((item) => item.id === columnId);
    const isPrimary = sorting[0]?.id === columnId;
    const icon =
      !active || !isPrimary ? (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      ) : active.desc ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUp className="h-3 w-3" />
      );
    return (
      <button type="button" className="col-filter-trigger" onClick={() => toggleSort(columnId)}>
        <span className="col-header-label">{COLUMN_LABELS[columnId]}</span>
        {icon}
      </button>
    );
  };

  const renderFilterHeader = (columnId: DiffTableColumnId) => {
    if (!isFacetColumn(columnId)) return null;
    const facet = facets?.facets[columnId];
    const formatOption =
      columnId === "changeStatus"
        ? (value: string) =>
            DIFF_CHANGE_STATUS_LABELS[value as keyof typeof DIFF_CHANGE_STATUS_LABELS] ??
            value
        : columnId === "changedFields"
          ? (value: string) =>
              DIFF_CHANGED_FIELD_LABELS[value as keyof typeof DIFF_CHANGED_FIELD_LABELS] ??
              value
          : undefined;
    return (
      <ColumnHeaderFilter
        column={columnId}
        header={headers[columnId]}
        open={openColumn === columnId}
        selected={facetValues(filters, columnId)}
        options={facet?.options ?? []}
        totalDistinct={facet?.totalDistinct ?? 0}
        search={facetSearch[columnId] ?? ""}
        loading={facetsLoading}
        error={facetsError}
        formatOption={formatOption}
        fontClassName={ibmPlexSans.className}
        onToggle={() => toggleColumn(columnId)}
        onClose={() => closeColumn(columnId)}
        onChange={(values) => onFilterChange(columnId, values)}
        onSearchChange={(search) => onFacetSearchChange(columnId, search)}
        onClear={() => clearColumn(columnId)}
      />
    );
  };

  const renderHeaderCell = (columnId: DiffTableColumnId) => {
    if (SORT_COLUMNS.has(columnId as SortableColumn) && columnId !== "abc") {
      return renderSortHeader(columnId as SortableColumn);
    }
    if (columnId === "legalAddress") {
      return <span className="col-header-label">{COLUMN_LABELS.legalAddress}</span>;
    }
    return renderFilterHeader(columnId);
  };

  const renderCell = (row: NumberRangeRow, columnId: DiffTableColumnId): ReactNode => {
    switch (columnId) {
      case "abc":
        return row.abc;
      case "rangeStart":
        return formatRangeSegment(row.rangeStart);
      case "rangeEnd":
        return formatRangeSegment(row.rangeEnd);
      case "capacity":
        return formatNumber(row.capacity);
      case "operator":
        return row.operator;
      case "garTerritory":
        return row.garTerritory;
      case "legalAddress":
        return renderLegalAddressCell(row, isDiffView);
      case "inn":
        return renderInnCell(row, isDiffView);
      case "uvrAntifraud":
        return row.uvrAntifraud != null ? String(row.uvrAntifraud) : "—";
      case "changeStatus": {
        const label = formatChangeStatusLabel(row);
        if (label === "—") return label;
        return (
          <button
            type="button"
            className="text-left underline decoration-current underline-offset-2 hover:opacity-80"
            onClick={() => {
              setDetailRow(row);
              setDetailOpen(true);
            }}
          >
            {label}
          </button>
        );
      }
      case "changedFields": {
        const label = formatChangedFieldsLabel(row);
        if (label === "—") return label;
        return (
          <button
            type="button"
            className="text-left underline decoration-current underline-offset-2 hover:opacity-80"
            onClick={() => {
              setDetailRow(row);
              setDetailOpen(true);
            }}
          >
            {label}
          </button>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      {facetsError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Фильтры: {facetsError}
        </div>
      ) : null}
      <ColumnWidthProbe
        texts={longestTexts}
        fontClassName={ibmPlexSans.className}
        onMeasure={onMeasure}
      />
      <div
        ref={scrollRef}
        className={cn(
          ibmPlexSans.className,
          "min-h-0 min-w-0 flex-1 overflow-auto"
        )}
      >
        <Table
          containerClassName="w-max max-w-none"
          className="w-max border-separate border-spacing-0 text-xs"
        >
          <TableHeader className="[&_tr]:!border-b-0">
            <TableRow className="border-0 hover:bg-background">
              {columnOrder.map((columnId) => (
                <TableHead
                  key={columnId}
                  className={HEAD_CLASS}
                  style={
                    minWidths[columnId] !== undefined
                      ? { minWidth: minWidths[columnId] }
                      : undefined
                  }
                >
                  {renderHeaderCell(columnId)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={isFetching ? "opacity-60" : ""}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index} className="border-0">
                  {columnOrder.map((columnId) => (
                    <TableCell key={columnId} className={CELL_CLASS}>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : errorMessage ? (
              <TableRow className="border-0">
                <TableCell
                  colSpan={columnOrder.length}
                  className="h-24 border-b text-center text-red-700"
                >
                  Ошибка загрузки таблицы: {errorMessage}
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow className="border-0">
                <TableCell
                  colSpan={columnOrder.length}
                  className="h-24 border-b text-center text-muted-foreground"
                >
                  Нет данных. Нажмите «Загрузить данные» для загрузки.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {paddingTop > 0 ? (
                  <TableRow aria-hidden className="border-0 hover:bg-transparent">
                    <TableCell
                      colSpan={columnOrder.length}
                      className="border-0 p-0"
                      style={{ height: paddingTop }}
                    />
                  </TableRow>
                ) : null}
                {virtualRows.map((virtualRow) => {
                  const row = data[virtualRow.index];
                  const prev = data[virtualRow.index - 1];
                  const { gapBefore, gapAfter } = showGapMarkers
                    ? effectiveAbcRangeGapMarkers(row, prev)
                    : { gapBefore: false, gapAfter: false };
                  const gapClass = numberingGapShadowClass(gapBefore, gapAfter);
                  return (
                    <TableRow
                      key={`${row.id}-${virtualRow.index}`}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={cn(
                        "border-0",
                        getRangeRowHighlightClass(row, { isDiff: isDiffView })
                      )}
                    >
                      {columnOrder.map((columnId) => (
                        <TableCell
                          key={`${row.id}-${columnId}`}
                          className={cn(
                            CELL_CLASS,
                            BOLD_COLUMNS.has(columnId) && "font-bold",
                            gapClass
                          )}
                        >
                          {renderCell(row, columnId)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {paddingBottom > 0 ? (
                  <TableRow aria-hidden className="border-0 hover:bg-transparent">
                    <TableCell
                      colSpan={columnOrder.length}
                      className="border-0 p-0"
                      style={{ height: paddingBottom }}
                    />
                  </TableRow>
                ) : null}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {totalRows < 0
            ? `Загружено ${formatNumber(data.length)}${hasMore ? "+" : ""}`
            : `Загружено ${formatNumber(data.length)} из ${formatNumber(totalRows)}`}
          {isFetchingNextPage ? " · загрузка…" : ""}
        </span>
        {hasMore && !isFetchingNextPage && onLoadMore ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onLoadMore()}
          >
            Загрузить ещё
          </button>
        ) : null}
      </div>

      {loadMoreError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {loadMoreError}
          {hasMore && onLoadMore ? (
            <>
              {" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => onLoadMore()}
              >
                Повторить
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {!isDiffView ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
          Подсветка строк: ярко-жёлтый — Фронтир Нетворк; синий — ABC 80x;
          светло-зелёный — ABC 9xx. Красные линии — разрывы нумерации ABC.
        </div>
      ) : null}

      {isDiffView ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
          Режим просмотра расхождений: зелёный — добавлено, жёлтый — изменено,
          красный — удалено. Колонка «Статус» — тип события; «Изменения» —
          какие поля отличаются. Нажмите на «Статус» или «Изменения», чтобы
          открыть детализацию «предыдущая / новая версия».
        </div>
      ) : null}

      {isDiffView ? (
        <DiffChangeDetailDialog
          row={detailRow}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setDetailRow(null);
          }}
        />
      ) : null}
    </div>
  );
}
