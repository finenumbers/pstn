import type { DatasetListItem } from "@/packages/shared/contracts/dataset.schema";
import { formatAsOfDisplayDate } from "@/packages/shared/contracts/dataset.schema";

export type DiffMonthGroup = {
  /** YYYY-MM */
  monthKey: string;
  /** Расхождения / MM.YYYY */
  label: string;
  items: DatasetListItem[];
};

/** "2026-08-08" → "Расхождения / 08.2026" */
export function formatDiffMonthGroupLabel(loadDate: string): string {
  const [year, month] = loadDate.split("-");
  if (!year || !month) return "Расхождения";
  return `Расхождения / ${month}.${year}`;
}

/** "2026-08-08" → "08.08.2026" */
export function formatDiffDayLabel(loadDate: string): string {
  return formatAsOfDisplayDate(loadDate);
}

function monthKeyFromLoadDate(loadDate: string): string {
  return loadDate.slice(0, 7);
}

/**
 * Group diff snapshots by YYYY-MM.
 * Months DESC, dates within month DESC (by loadDate).
 */
export function groupDiffDatasetsByMonth(
  items: readonly DatasetListItem[]
): DiffMonthGroup[] {
  const diffs = items.filter((item) => item.kind === "diff");
  const byMonth = new Map<string, DatasetListItem[]>();

  for (const item of diffs) {
    const key = monthKeyFromLoadDate(item.loadDate);
    const list = byMonth.get(key);
    if (list) {
      list.push(item);
    } else {
      byMonth.set(key, [item]);
    }
  }

  const monthKeys = [...byMonth.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  return monthKeys.map((monthKey) => {
    const groupItems = (byMonth.get(monthKey) ?? []).slice().sort((a, b) => {
      if (a.loadDate < b.loadDate) return 1;
      if (a.loadDate > b.loadDate) return -1;
      return 0;
    });
    const sampleDate = groupItems[0]?.loadDate ?? `${monthKey}-01`;
    return {
      monthKey,
      label: formatDiffMonthGroupLabel(sampleDate),
      items: groupItems,
    };
  });
}
