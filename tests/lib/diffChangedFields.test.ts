import {
  buildWasStoRows,
  computeChangedFieldKeys,
  computeChangedMetadataFieldKeys,
  formatChangedFieldsLabel,
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

  it("labels added and removed rows", () => {
    expect(formatChangedFieldsLabel(diffRow({ changeType: "added" }))).toBe(
      "Добавлено"
    );
    expect(computeChangedFieldKeys(diffRow({ changeType: "added" }))).toEqual([
      "added",
    ]);
    expect(formatChangedFieldsLabel(diffRow({ changeType: "removed" }))).toBe(
      "Удалено"
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
});
