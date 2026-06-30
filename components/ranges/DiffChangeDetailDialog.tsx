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
  formatWasStoCell,
} from "@/lib/diff/diffChangedFields";
import { cn, formatRangeSegment } from "@/lib/utils";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

const CHANGE_TYPE_LABELS: Record<
  NonNullable<NumberRangeRow["changeType"]>,
  string
> = {
  added: "Добавлено",
  changed: "Изменено",
  removed: "Удалено",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Изменение диапазона</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold",
                changeType === "added" && "bg-green-600 text-white",
                changeType === "changed" && "bg-yellow-400 text-foreground",
                changeType === "removed" && "bg-red-500 text-white"
              )}
            >
              {CHANGE_TYPE_LABELS[changeType]}
            </span>
          </DialogTitle>
          <DialogDescription>
            ABC {row.abc} · {formatRangeSegment(row.rangeStart)} –{" "}
            {formatRangeSegment(row.rangeEnd)} · ёмкость {row.capacity}
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Поле</TableHead>
              <TableHead className="w-[36%]">Было</TableHead>
              <TableHead className="w-[36%]">Стало</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wasStoRows.map((entry) => (
              <TableRow
                key={entry.key}
                className={cn(entry.changed && "bg-yellow-100/80")}
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
