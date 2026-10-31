import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { parseCsvStream } from "@/packages/import/csvParser";

describe("parseCsvStream 1:1 territory mapping", () => {
  it("keeps GAR and INN when the CSV region column is present", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      '301;2110000;2114999;5000;ПАО "Ростелеком";Республика Бурятия;г. Улан-Удэ|Республика Бурятия;7707049388',
    ].join("\n");

    const collected: Array<{
      operator: string;
      garTerritory: string;
      inn: string;
    }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          operator: row.operator,
          garTerritory: row.garTerritory,
          inn: row.inn,
        });
      }
    });

    expect(collected).toEqual([
      {
        operator: 'ПАО "Ростелеком"',
        garTerritory: "г. Улан-Удэ|Республика Бурятия",
        inn: "7707049388",
      },
    ]);
    expect(collected[0]).not.toHaveProperty("region");
  });

  it("trims whitespace from GAR and does not store region", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      "301;2110000;2114999;5000;Op;  Вологодская обл. ;  м.р-н Никольский ;123",
    ].join("\n");

    const collected: Array<{ garTerritory: string; inn: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          garTerritory: row.garTerritory,
          inn: row.inn,
        });
      }
    });

    expect(collected[0]).toEqual({
      garTerritory: "м.р-н Никольский",
      inn: "123",
    });
  });

  it("preserves special federal city GAR strings as-is", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      "495;1000000;1000999;1000;Op;ГФЗ Москва;Город Москва;7707049388",
      "812;2000000;2000999;1000;Op;ГФЗ Санкт-Петербург;Город Санкт-Петербург;7707049388",
    ].join("\n");

    const collected: Array<{ garTerritory: string; inn: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          garTerritory: row.garTerritory,
          inn: row.inn,
        });
      }
    });

    expect(collected).toEqual([
      { garTerritory: "Город Москва", inn: "7707049388" },
      { garTerritory: "Город Санкт-Петербург", inn: "7707049388" },
    ]);
  });

  it("parses operator names with embedded quotes", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      '301;2110000;2114999;5000;ПАО "Ростелеком";Республика Бурятия;г. Улан-Удэ|Республика Бурятия;7707049388',
    ].join("\n");

    const collected: Array<{ operator: string; inn: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({ operator: row.operator, inn: row.inn });
      }
    });

    expect(collected[0].operator).toBe('ПАО "Ростелеком"');
    expect(collected[0].inn).toBe("7707049388");
  });

  it("allows empty GAR and INN while ignoring an empty region column", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      "301;2110000;2114999;5000;Op;;;",
    ].join("\n");

    const collected: Array<{ garTerritory: string; inn: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          garTerritory: row.garTerritory,
          inn: row.inn,
        });
      }
    });

    expect(collected[0]).toEqual({ garTerritory: "", inn: "" });
  });
});
