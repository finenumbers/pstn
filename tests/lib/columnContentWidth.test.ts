import { describe, expect, it } from "vitest";
import { longestColumnTexts } from "@/lib/table/columnContentWidth";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

function row(patch: Partial<NumberRangeRow> = {}): NumberRangeRow {
  return {
    id: 1,
    abc: "301",
    rangeStart: 0,
    rangeEnd: 999,
    capacity: 1000,
    operator: "Короткий",
    garTerritory: "Улан-Удэ",
    inn: "",
    legalAddress: null,
    uvrAntifraud: null,
    abcRangeGapBefore: false,
    abcRangeGapAfter: false,
    ...patch,
  };
}

const headers = {
  operator: "Оператор связи",
  legalAddress: "Юридический адрес",
  rangeStart: "Начало",
  capacity: "Емкость",
  inn: "ИНН",
};

describe("longestColumnTexts", () => {
  it("uses the full loaded page, the header, and the em dash", () => {
    const texts = longestColumnTexts(
      ["operator", "legalAddress", "rangeStart", "capacity", "inn"],
      headers,
      [
        row(),
        row({
          id: 2,
          operator: "Публичное акционерное общество Ростелеком",
          legalAddress: "г. Москва, ул. Длинная, дом 1",
          rangeStart: 888290,
          capacity: 12_500_000,
          inn: "7707049388",
        }),
      ]
    );

    expect(texts.operator).toBe("Публичное акционерное общество Ростелеком");
    expect(texts.legalAddress).toBe("г. Москва, ул. Длинная, дом 1");
    expect(texts.rangeStart).toBe("000-00-00");
    expect(texts.capacity).toBe(new Intl.NumberFormat("ru-RU").format(12_500_000));
    expect(texts.inn).toBe("7707049388");
  });

  it("keeps the header when every cell is shorter", () => {
    const texts = longestColumnTexts(["legalAddress"], headers, [row()]);
    expect(texts.legalAddress).toBe("Юридический адрес");
  });
});
