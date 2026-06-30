"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildWasStoRows,
  formatChangeStatusLabel,
  formatWasStoCell,
  getWasStoRowHighlightClass,
} from "@/lib/diff/diffChangedFields";
import { cn, formatRangeSegment } from "@/lib/utils";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

const DIALOG_TITLES: Record<
  NonNullable<NumberRangeRow["changeType"]>,
  string
> = {
  added: "Новый диапазон",
  changed: "Изменение диапазона",
  removed: "Удалённый диапазон",
};

const DIALOG_DESCRIPTIONS: Record<
  NonNullable<NumberRangeRow["changeType"]>,
  string
> = {
  added:
    "Диапазон появился в новой версии реестра и отсутствовал в предыдущей.",
  changed: "Изменились реквизиты при сохранении участка нумерации.",
  removed:
    "Диапазон был в предыдущей версии реестра и отсутствует в новой.",
};

interface DiffChangeDetailDialogProps {
  row: NumberRangeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiffChangeDetailDialog({
  row,
  open,
  onOpenChange,
}: DiffChangeDetailDialogProps) {
  if (!row) return null;

  const changeType = row.changeType ?? "changed";
  const wasStoRows = buildWasStoRows(row);
  const statusLabel = formatChangeStatusLabel(row);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{DIALOG_TITLES[changeType]}</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold",
                changeType === "added" && "bg-green-600 text-white",
                changeType === "changed" && "bg-yellow-400 text-foreground",
                changeType === "removed" && "bg-red-500 text-white"
              )}
            >
              {statusLabel}
            </span>
          </DialogTitle>
          <DialogDescription>
            ABC {row.abc} · {formatRangeSegment(row.rangeStart)} –{" "}
            {formatRangeSegment(row.rangeEnd)} · ёмкость {row.capacity}
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {DIALOG_DESCRIPTIONS[changeType]}
          </p>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Поле</TableHead>
              <TableHead className="w-[36%]">Предыдущая версия</TableHead>
              <TableHead className="w-[36%]">Новая версия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wasStoRows.map((entry) => (
              <TableRow
                key={entry.key}
                className={cn(getWasStoRowHighlightClass(changeType, entry))}
              >
                <TableCell className="font-medium">{entry.label}</TableCell>
                <TableCell className="break-words">
                  {formatWasStoCell(entry.before)}
                </TableCell>
                <TableCell className="break-words">
                  {formatWasStoCell(entry.after)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
