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
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { FacetCombobox } from "@/components/ranges/FacetCombobox";
import { FilterTextInput } from "@/components/ranges/FilterTextInput";
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
import { formatSettlementDisplay } from "@/lib/filters/settlementDisplay";
import {
  compactColumnStyle,
  computeAbcFilterColumnWidth,
  computeCompactColumnWidths,
  computeInnColumnWidth,
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
}

const COLUMN_ORDER: SortableColumn[] = [
  "abc",
  "rangeStart",
  "rangeEnd",
  "capacity",
  "operator",
  "settlement",
  "region",
  "inn",
];

const COLUMN_LABELS: Record<SortableColumn, string> = {
  abc: "ABC",
  rangeStart: "Начало",
  rangeEnd: "Конец",
  capacity: "Емкость",
  operator: "Оператор связи",
  settlement: "Населенный пункт",
  region: "Регион",
  inn: "ИНН",
};

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
}: RangesTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
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
      { accessorKey: "settlement", header: "Населенный пункт" },
      { accessorKey: "region", header: "Регион" },
      {
        accessorKey: "inn",
        header: "ИНН",
        cell: ({ row }: { row: { original: NumberRangeRow } }) => {
          const inn = row.original.inn;
          const href = dadataPartyUrl(inn);
          if (!href) return inn || "—";
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-inherit underline decoration-black underline-offset-2"
            >
              {inn}
            </a>
          );
        },
      },
    ],
    []
  );

  const compactWidths = useMemo(
    () => computeCompactColumnWidths(data),
    [data]
  );

  const abcColumnWidthCh = useMemo(
    () => computeAbcFilterColumnWidth(filters.abc.length, "ABC"),
    [filters.abc.length]
  );

  const innColumnWidthCh = useMemo(
    () => computeInnColumnWidth(data, filters.inn),
    [data, filters.inn]
  );

  const getColumnWidthCh = (columnId: string): number | undefined => {
    if (columnId === "abc") return abcColumnWidthCh;
    if (columnId === "inn") return innColumnWidthCh;
    if (columnId === "operator" || columnId === "settlement" || columnId === "region") return undefined;
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
        style: compactColumnStyle(innColumnWidthCh),
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
    if (columnId === "operator" || columnId === "settlement" || columnId === "region") {
      return undefined;
    }
    if (columnId === "abc") {
      return columnWidthStyle(abcColumnWidthCh);
    }
    if (columnId === "inn") {
      return columnWidthStyle(innColumnWidthCh);
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

  const showGapMarkers = isGapCompatibleSort(
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
    const { gapBefore, gapAfter } = effectiveAbcRangeGapMarkers(
      row.original,
      prev
    );

    return (
      <TableRow
        key={`${row.original.id}-${rowIndex}`}
        className={cn(
          isFrontirNetworkInn(row.original.inn) &&
            "bg-yellow-400 hover:bg-yellow-400/90",
          isNineSeriesAbc(row.original.abc) &&
            !isFrontirNetworkInn(row.original.inn) &&
            "bg-green-100 hover:bg-green-100/90",
          gapBefore && showGapMarkers && "range-gap-before",
          gapAfter && showGapMarkers && "range-gap-after"
        )}
      >
        {row.getVisibleCells().map((cell) => {
          const compact = getCompactCellProps(cell.column.id);
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
      className="flex items-center gap-1 text-xs font-medium hover:text-foreground"
      onClick={() => toggleSort(columnId)}
    >
      {COLUMN_LABELS[columnId]}
      <SortIcon columnId={columnId} />
    </button>
  );

  const renderHeaderCell = (colId: SortableColumn) => {
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
      case "settlement":
        return (
          <FacetCombobox
            label="Населенный пункт"
            values={filters.settlement}
            search={facetSearch.settlement ?? ""}
            options={facets?.facets.settlement?.options ?? []}
            onChange={(v) => onFilterChange("settlement", v)}
            onSearchChange={(s) => onFacetSearchChange("settlement", s)}
            isLoading={facetsLoading}
            placeholder="Населенный пункт"
            formatOption={formatSettlementDisplay}
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
          <FilterTextInput
            value={filters.inn}
            onChange={(v) => onFilterChange("inn", v)}
            placeholder="ИНН"
            className="w-full"
          />
        );
      default:
        return null;
    }
  };

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
            {COLUMN_ORDER.map((colId) => {
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
              {COLUMN_ORDER.map((colId) => {
                const compact = getCompactCellProps(colId);
                const hasFilter =
                  colId === "abc" ||
                  colId === "operator" ||
                  colId === "settlement" ||
                  colId === "region" ||
                  colId === "inn";
                return (
                  <TableHead
                    key={colId}
                    className={cn(
                      "sticky top-0 z-30 h-10 px-1 py-0 align-middle",
                      "border-b bg-background shadow-[0_1px_0_0_var(--color-border)]",
                      hasFilter && "bg-muted",
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
                  {COLUMN_ORDER.map((colId) => (
                    <TableCell key={colId}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : errorMessage ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_ORDER.length}
                  className="h-24 text-center text-red-700"
                >
                  Ошибка загрузки таблицы: {errorMessage}
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_ORDER.length}
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
                      colSpan={COLUMN_ORDER.length}
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
                      colSpan={COLUMN_ORDER.length}
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

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Загружено {formatNumber(data.length)} из {formatNumber(totalRows)}
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
    </div>
  );
}
