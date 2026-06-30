import {
  buildWasStoRows,
  computeChangedFieldKeys,
  computeChangedMetadataFieldKeys,
  formatChangeStatusLabel,
  formatChangedFieldsLabel,
  getWasStoRowHighlightClass,
} from "@/lib/diff/diffChangedFields";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";
import { describe, expect, it } from "vitest";

function diffRow(
  overrides: Partial<NumberRangeRow> & Pick<NumberRangeRow, "changeType">
): NumberRangeRow {
  return {
    id: 1,
    abc: "343",
    rangeStart: 2110200,
    rangeEnd: 2111099,
    capacity: 900,
    operator: 'ООО "ИНСИС"',
    region: "-",
    garTerritory: "г.о. город Екатеринбург|Свердловская область",
    inn: "6662103947",
    uvrAntifraud: null,
    abcRangeGapBefore: false,
    abcRangeGapAfter: false,
    ...overrides,
  };
}

describe("diffChangedFields", () => {
  it("detects region-only change (ABC 343 case)", () => {
    const row = diffRow({
      changeType: "changed",
      prevRegion: "г. Екатеринбург|Свердловская обл.",
      prevGarTerritory: "г.о. город Екатеринбург|Свердловская область",
      prevOperator: 'ООО "ИНСИС"',
      prevInn: "6662103947",
    });

    expect(computeChangedMetadataFieldKeys(row)).toEqual(["region"]);
    expect(formatChangedFieldsLabel(row)).toBe("Регион");
    expect(computeChangedFieldKeys(row)).toEqual(["region"]);
  });

  it("maps change status labels", () => {
    expect(formatChangeStatusLabel(diffRow({ changeType: "added" }))).toBe(
      "Новый ресурс"
    );
    expect(formatChangeStatusLabel(diffRow({ changeType: "changed" }))).toBe(
      "Изменение ресурса"
    );
    expect(formatChangeStatusLabel(diffRow({ changeType: "removed" }))).toBe(
      "Удаление ресурса"
    );
  });

  it("returns dash in Изменения for added and removed rows", () => {
    expect(formatChangedFieldsLabel(diffRow({ changeType: "added" }))).toBe("—");
    expect(computeChangedFieldKeys(diffRow({ changeType: "added" }))).toEqual(
      []
    );
    expect(formatChangedFieldsLabel(diffRow({ changeType: "removed" }))).toBe(
      "—"
    );
  });

  it("builds was/sto rows with changed flag on region only", () => {
    const row = diffRow({
      changeType: "changed",
      prevRegion: "г. Екатеринбург|Свердловская обл.",
      prevOperator: 'ООО "ИНСИС"',
      prevInn: "6662103947",
      prevGarTerritory: "г.о. город Екатеринбург|Свердловская область",
    });

    const rows = buildWasStoRows(row);
    expect(rows.find((r) => r.key === "region")).toMatchObject({
      before: "г. Екатеринбург|Свердловская обл.",
      after: "-",
      changed: true,
    });
    expect(rows.find((r) => r.key === "operator")?.changed).toBe(false);
  });

  it("uses type-specific highlight classes in detail rows", () => {
    const changedRow = diffRow({
      changeType: "changed",
      prevRegion: "old",
    });
    const changedRows = buildWasStoRows(changedRow);
    const regionRow = changedRows.find((r) => r.key === "region")!;
    expect(getWasStoRowHighlightClass("changed", regionRow)).toBe(
      "bg-yellow-100/80"
    );
    expect(
      getWasStoRowHighlightClass(
        "changed",
        changedRows.find((r) => r.key === "operator")!
      )
    ).toBeUndefined();

    const addedRows = buildWasStoRows(diffRow({ changeType: "added" }));
    expect(getWasStoRowHighlightClass("added", addedRows[0]!)).toBe(
      "bg-green-100/80"
    );

    const removedRows = buildWasStoRows(diffRow({ changeType: "removed" }));
    expect(getWasStoRowHighlightClass("removed", removedRows[0]!)).toBe(
      "bg-red-100/80"
    );
  });
});
