import { describe, expect, it } from "vitest";
import {
  formatDiffDayLabel,
  formatDiffMonthGroupLabel,
  groupDiffDatasetsByMonth,
} from "@/lib/datasets/groupDiffDatasets";
import type { DatasetListItem } from "@/packages/shared/contracts/dataset.schema";

function diff(id: string, loadDate: string): DatasetListItem {
  return {
    id,
    kind: "diff",
    label: `Расхождения ${formatDiffDayLabel(loadDate)}`,
    loadDate,
  };
}

describe("formatDiffMonthGroupLabel", () => {
  it("formats as Расхождения / MM.YYYY", () => {
    expect(formatDiffMonthGroupLabel("2026-08-08")).toBe("Расхождения / 08.2026");
    expect(formatDiffMonthGroupLabel("2026-07-15")).toBe("Расхождения / 07.2026");
  });
});

describe("formatDiffDayLabel", () => {
  it("formats as DD.MM.YYYY", () => {
    expect(formatDiffDayLabel("2026-08-08")).toBe("08.08.2026");
  });
});

describe("groupDiffDatasetsByMonth", () => {
  it("groups by month DESC and dates DESC, ignores current", () => {
    const items: DatasetListItem[] = [
      {
        id: "current",
        kind: "current",
        label: "Датасет 08.08.2026",
        loadDate: "2026-08-08",
      },
      diff("a", "2026-07-15"),
      diff("b", "2026-08-02"),
      diff("c", "2026-08-08"),
      diff("d", "2026-07-01"),
    ];

    const groups = groupDiffDatasetsByMonth(items);
    expect(groups.map((g) => g.label)).toEqual([
      "Расхождения / 08.2026",
      "Расхождения / 07.2026",
    ]);
    expect(groups[0]!.items.map((i) => i.loadDate)).toEqual([
      "2026-08-08",
      "2026-08-02",
    ]);
    expect(groups[1]!.items.map((i) => i.loadDate)).toEqual([
      "2026-07-15",
      "2026-07-01",
    ]);
  });
});
