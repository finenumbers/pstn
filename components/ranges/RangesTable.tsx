"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FacetCombobox } from "@/components/ranges/FacetCombobox";
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
import {
  DIFF_CHANGED_FIELD_LABELS,
  formatChangedFieldsLabel,
} from "@/lib/diff/diffChangedFields";
import {
  compactColumnStyle,
  computeAbcFilterColumnWidth,
  computeCompactColumnWidths,
  INN_COLUMN_WIDTH_CH,
  UVR_ANTIFRAUD_COLUMN_WIDTH_CH,
  columnWidthStyle,
  isCompactColumn,
} from "@/lib/table/compactColumns";
import { isFrontirNetworkInn } from "@/lib/table/highlightedInns";
import { effectiveAbcRangeGapMarkers } from "@/lib/table/abcRangeGapDisplay";
import { isGapCompatibleSort } from "@/lib/sort/normalizeRangesSort";
import { cn, formatNumber, formatRangeSegment } from "@/lib/utils";
import { sortFromSingleColumn } from "@/lib/sort/normalizeRangesSort";
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
  facetsError?: string;
  isDiffView?: boolean;
}

const COLUMN_ORDER = [
  "abc",
  "rangeStart",
  "rangeEnd",
  "capacity",
  "operator",
  "region",
  "garTerritory",
  "uvrAntifraud",
  "inn",
] as const;

const DIFF_COLUMN_ORDER = [
  ...COLUMN_ORDER,
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
  region: "Регион",
  inn: "ИНН",
  uvrAntifraud: "УВр Антифрод",
};

const DIFF_COLUMN_LABELS: Record<DiffTableColumnId, string> = {
  ...COLUMN_LABELS,
  changedFields: "Изменения",
};

function renderInnCellValue(inn: string | null | undefined) {
  const display = inn && inn.length > 0 ? inn : "—";
  if (display === "—") return display;
  const href = dadataPartyUrl(inn!);
  if (!href) return display;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit underline decoration-black underline-offset-2"
    >
      {display}
    </a>
  );
}

function isNineSeriesAbc(abc: string): boolean {
  return abc.startsWith("9");
}

const ROW_HEIGHT_PX = 40;

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
  facetsError,
  isDiffView = false,
}: RangesTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [detailRow, setDetailRow] = useState<NumberRangeRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const columnOrder = isDiffView ? DIFF_COLUMN_ORDER : COLUMN_ORDER;

  const standardColumns = useMemo(
    () => [
      { accessorKey: "abc", header: "ABC" },
      {
        accessorKey: "rangeStart",
        header: "Начало",
        cell: ({ row }: { row: { original: NumberRangeRow } }) =>
          formatRangeSegment(row.original.rangeStart),
      },
      {
        accessorKey: "rangeEnd",
        header: "Конец",
        cell: ({ row }: { row: { original: NumberRangeRow } }) =>
          formatRangeSegment(row.original.rangeEnd),
      },
      {
        accessorKey: "capacity",
        header: "Емкость",
        cell: ({ row }: { row: { original: NumberRangeRow } }) =>
          formatNumber(row.original.capacity),
      },
      { accessorKey: "operator", header: "Оператор связи" },
      { accessorKey: "region", header: "Регион" },
      { accessorKey: "garTerritory", header: "Территория ГАР" },
      {
        accessorKey: "uvrAntifraud",
        header: "УВр Антифрод",
        cell: ({ row }: { row: { original: NumberRangeRow } }) => {
          const value = row.original.uvrAntifraud;
          return value != null ? String(value) : "—";
        },
      },
      {
        accessorKey: "inn",
        header: "ИНН",
        cell: ({ row }: { row: { original: NumberRangeRow } }) =>
          renderInnCellValue(row.original.inn),
      },
    ],
    []
  );

  const columns = useMemo(() => {
    if (!isDiffView) return standardColumns;
    return [
      ...standardColumns,
      {
        id: "changedFields",
        accessorKey: "changedFields",
        header: DIFF_COLUMN_LABELS.changedFields,
        cell: ({ row }: { row: { original: NumberRangeRow } }) => {
          const label = formatChangedFieldsLabel(row.original);
          if (label === "—") return label;
          return (
            <button
              type="button"
              className="text-left underline decoration-current underline-offset-2 hover:opacity-80"
              onClick={() => {
                setDetailRow(row.original);
                setDetailOpen(true);
              }}
            >
              {label}
            </button>
          );
        },
      },
    ];
  }, [isDiffView, standardColumns]);

  const compactWidths = useMemo(
    () => computeCompactColumnWidths(data),
    [data]
  );

  const abcColumnWidthCh = useMemo(
    () => computeAbcFilterColumnWidth(filters.abc.length, "ABC"),
    [filters.abc.length]
  );

  const getColumnWidthCh = (columnId: string): number | undefined => {
    if (columnId === "abc") return abcColumnWidthCh;
    if (columnId === "inn") {
      return INN_COLUMN_WIDTH_CH;
    }
    if (columnId === "uvrAntifraud") return UVR_ANTIFRAUD_COLUMN_WIDTH_CH;
    if (
      columnId === "operator" ||
      columnId === "garTerritory" ||
      columnId === "region" ||
      columnId === "changedFields"
    ) {
      return undefined;
    }
    if (isCompactColumn(columnId)) return compactWidths[columnId];
    return undefined;
  };

  const getCompactCellProps = (columnId: string) => {
    if (columnId === "abc") {
      return {
        className: "whitespace-nowrap tabular-nums",
        style: compactColumnStyle(abcColumnWidthCh),
      };
    }
    if (columnId === "inn") {
      return {
        className: "whitespace-nowrap tabular-nums",
        style: compactColumnStyle(INN_COLUMN_WIDTH_CH),
      };
    }
    if (columnId === "uvrAntifraud") {
      return {
        className: "whitespace-nowrap tabular-nums",
        style: compactColumnStyle(UVR_ANTIFRAUD_COLUMN_WIDTH_CH),
      };
    }
    if (!isCompactColumn(columnId)) {
      return { className: undefined, style: undefined };
    }
    const ch = compactWidths[columnId];
    return {
      className: "whitespace-nowrap tabular-nums",
      style: compactColumnStyle(ch),
    };
  };

  const getHeaderStyle = (columnId: string): CSSProperties | undefined => {
    if (
      columnId === "operator" ||
      columnId === "garTerritory" ||
      columnId === "region" ||
      columnId === "changedFields"
    ) {
      return undefined;
    }
    if (columnId === "abc") {
      return columnWidthStyle(abcColumnWidthCh);
    }
    if (columnId === "inn") {
      return compactColumnStyle(INN_COLUMN_WIDTH_CH);
    }
    if (columnId === "uvrAntifraud") {
      return compactColumnStyle(UVR_ANTIFRAUD_COLUMN_WIDTH_CH);
    }
    if (isCompactColumn(columnId)) {
      return compactColumnStyle(compactWidths[columnId]);
    }
    return undefined;
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop =
    virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const showGapMarkers =
    !isDiffView &&
    isGapCompatibleSort(
      sorting.map((s) => ({
        id: s.id as SortableColumn,
        desc: s.desc ?? false,
      }))
    );

  const renderDataRow = (
    row: Row<NumberRangeRow>,
    rowIndex: number,
    prev?: NumberRangeRow
  ) => {
    const { gapBefore, gapAfter } = isDiffView
      ? { gapBefore: false, gapAfter: false }
      : effectiveAbcRangeGapMarkers(row.original, prev);
    const changeType = row.original.changeType;

    return (
      <TableRow
        key={`${row.original.id}-${rowIndex}`}
        className={cn(
          isDiffView &&
            changeType === "added" &&
            "bg-green-600 text-white hover:bg-green-600/90",
          isDiffView &&
            changeType === "changed" &&
            "bg-yellow-400 hover:bg-yellow-400/90",
          isDiffView &&
            changeType === "removed" &&
            "bg-red-500 text-white hover:bg-red-500/90",
          !isDiffView &&
            isFrontirNetworkInn(row.original.inn) &&
            "bg-yellow-400 hover:bg-yellow-400/90",
          !isDiffView &&
            isNineSeriesAbc(row.original.abc) &&
            !isFrontirNetworkInn(row.original.inn) &&
            "bg-green-100 hover:bg-green-100/90",
          gapBefore && showGapMarkers && "range-gap-before",
          gapAfter && showGapMarkers && "range-gap-after"
        )}
      >
        {columnOrder.map((colId) => {
          const cell = row
            .getVisibleCells()
            .find((visibleCell) => visibleCell.column.id === colId);
          if (!cell) return null;
          const compact = getCompactCellProps(colId);
          return (
            <TableCell
              key={cell.id}
              className={compact.className}
              style={compact.style}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [listKey]);

  const lastVirtualIndex = virtualRows[virtualRows.length - 1]?.index;

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onLoadMore || !hasMore || isFetchingNextPage) return;
    const items = rowVirtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (last && last.index >= tableRows.length - 8) {
      onLoadMore();
    }
  }, [
    virtualRows.length,
    lastVirtualIndex,
    tableRows.length,
    onLoadMore,
    hasMore,
    isFetchingNextPage,
    rowVirtualizer,
  ]);

  const toggleSort = (columnId: SortableColumn) => {
    const existing = sorting.find((x) => x.id === columnId);
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

  const SortIcon = ({ columnId }: { columnId: SortableColumn }) => {
    const s = sorting.find((x) => x.id === columnId);
    if (!s) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return s.desc ? (
      <ArrowDown className="h-3.5 w-3.5" />
    ) : (
      <ArrowUp className="h-3.5 w-3.5" />
    );
  };

  const SortHeader = ({ columnId }: { columnId: SortableColumn }) => (
    <button
      type="button"
      className="flex items-center gap-1 text-xs font-bold hover:text-foreground"
      onClick={() => toggleSort(columnId)}
    >
      {COLUMN_LABELS[columnId]}
      <SortIcon columnId={columnId} />
    </button>
  );

  const renderHeaderCell = (colId: TableColumnId | DiffTableColumnId) => {
    switch (colId) {
      case "abc":
        return (
          <FacetCombobox
            label="ABC"
            values={filters.abc}
            search={facetSearch.abc ?? ""}
            options={facets?.facets.abc?.options ?? []}
            onChange={(v) => onFilterChange("abc", v)}
            onSearchChange={(s) => onFacetSearchChange("abc", s)}
            isLoading={facetsLoading}
            placeholder="ABC"
            compact
          />
        );
      case "rangeStart":
      case "rangeEnd":
      case "capacity":
        return <SortHeader columnId={colId} />;
      case "changedFields":
        return (
          <FacetCombobox
            label={DIFF_COLUMN_LABELS.changedFields}
            values={filters.changedFields}
            search={facetSearch.changedFields ?? ""}
            options={facets?.facets.changedFields?.options ?? []}
            onChange={(v) => onFilterChange("changedFields", v)}
            onSearchChange={(s) => onFacetSearchChange("changedFields", s)}
            isLoading={facetsLoading}
            placeholder={DIFF_COLUMN_LABELS.changedFields}
            formatOption={(value) =>
              DIFF_CHANGED_FIELD_LABELS[
                value as keyof typeof DIFF_CHANGED_FIELD_LABELS
              ] ?? value
            }
          />
        );
      case "operator":
        return (
          <FacetCombobox
            label="Оператор связи"
            values={filters.operator}
            search={facetSearch.operator ?? ""}
            options={facets?.facets.operator?.options ?? []}
            onChange={(v) => onFilterChange("operator", v)}
            onSearchChange={(s) => onFacetSearchChange("operator", s)}
            isLoading={facetsLoading}
            placeholder="Оператор связи"
          />
        );
      case "garTerritory":
        return (
          <FacetCombobox
            label="Территория ГАР"
            values={filters.garTerritory}
            search={facetSearch.garTerritory ?? ""}
            options={facets?.facets.garTerritory?.options ?? []}
            onChange={(v) => onFilterChange("garTerritory", v)}
            onSearchChange={(s) => onFacetSearchChange("garTerritory", s)}
            isLoading={facetsLoading}
            placeholder="Территория ГАР"
          />
        );
      case "region":
        return (
          <FacetCombobox
            label="Регион"
            values={filters.region}
            search={facetSearch.region ?? ""}
            options={facets?.facets.region?.options ?? []}
            onChange={(v) => onFilterChange("region", v)}
            onSearchChange={(s) => onFacetSearchChange("region", s)}
            isLoading={facetsLoading}
            placeholder="Регион"
          />
        );
      case "inn":
        return (
          <FacetCombobox
            label="ИНН"
            values={filters.inn}
            search={facetSearch.inn ?? ""}
            options={facets?.facets.inn?.options ?? []}
            onChange={(v) => onFilterChange("inn", v)}
            onSearchChange={(s) => onFacetSearchChange("inn", s)}
            isLoading={facetsLoading}
            placeholder="ИНН"
          />
        );
      case "uvrAntifraud":
        return (
          <FacetCombobox
            label="УВр Антифрод"
            values={filters.uvrAntifraud}
            search={facetSearch.uvrAntifraud ?? ""}
            options={facets?.facets.uvrAntifraud?.options ?? []}
            onChange={(v) => onFilterChange("uvrAntifraud", v)}
            onSearchChange={(s) => onFacetSearchChange("uvrAntifraud", s)}
            isLoading={facetsLoading}
            placeholder="УВр Антифрод"
          />
        );
      default:
        return null;
    }
  };

  const hasFilterColumn = (colId: TableColumnId | DiffTableColumnId) =>
    colId === "abc" ||
    colId === "operator" ||
    colId === "garTerritory" ||
    colId === "region" ||
    colId === "inn" ||
    colId === "uvrAntifraud" ||
    colId === "changedFields";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {facetsError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Фильтры: {facetsError}
        </div>
      )}
      <div
        ref={scrollRef}
        className="ranges-table-container min-h-0 flex-1 overflow-auto rounded-md border"
      >
        <Table className="table-fixed w-full border-separate border-spacing-0">
          <colgroup>
            {columnOrder.map((colId) => {
              const ch = getColumnWidthCh(colId);
              return (
                <col
                  key={colId}
                  style={ch !== undefined ? { width: `${ch}ch` } : undefined}
                />
              );
            })}
          </colgroup>
          <TableHeader className="sticky top-0 z-30 bg-background">
            <TableRow className="border-b hover:bg-transparent">
              {columnOrder.map((colId) => {
                const compact = getCompactCellProps(colId);
                return (
                  <TableHead
                    key={colId}
                    className={cn(
                      "sticky top-0 z-30 h-10 px-1 py-0 align-middle",
                      "border-b bg-background shadow-[0_1px_0_0_var(--color-border)]",
                      hasFilterColumn(colId) && "bg-muted",
                      compact.className
                    )}
                    style={getHeaderStyle(colId) ?? compact.style}
                  >
                    {renderHeaderCell(colId)}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody className={isFetching ? "opacity-60" : ""}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columnOrder.map((colId) => (
                    <TableCell key={colId}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : errorMessage ? (
              <TableRow>
                <TableCell
                  colSpan={columnOrder.length}
                  className="h-24 text-center text-red-700"
                >
                  Ошибка загрузки таблицы: {errorMessage}
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnOrder.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Нет данных. Нажмите «Загрузить данные» для загрузки.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {paddingTop > 0 && (
                  <TableRow aria-hidden className="border-0 hover:bg-transparent">
                    <TableCell
                      colSpan={columnOrder.length}
                      className="border-0 p-0"
                      style={{ height: paddingTop }}
                    />
                  </TableRow>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = tableRows[virtualRow.index];
                  return renderDataRow(
                    row,
                    virtualRow.index,
                    tableRows[virtualRow.index - 1]?.original
                  );
                })}
                {paddingBottom > 0 && (
                  <TableRow aria-hidden className="border-0 hover:bg-transparent">
                    <TableCell
                      colSpan={columnOrder.length}
                      className="border-0 p-0"
                      style={{ height: paddingBottom }}
                    />
                  </TableRow>
                )}
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
        {hasMore && !isFetchingNextPage && onLoadMore && (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onLoadMore()}
          >
            Загрузить ещё
          </button>
        )}
      </div>

      {isDiffView && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
          Режим просмотра расхождений: зелёный — добавлено, жёлтый — изменено,
          красный — удалено. Нажмите на «Изменения», чтобы увидеть было / стало.
        </div>
      )}

      {isDiffView && (
        <DiffChangeDetailDialog
          row={detailRow}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setDetailRow(null);
          }}
        />
      )}
    </div>
  );
}
