import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { parseCsvStream } from "@/packages/import/csvParser";

describe("parseCsvStream 1:1 territory mapping", () => {
  it("maps CSV region and GAR columns without transformation", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      '301;2110000;2114999;5000;ПАО "Ростелеком";Республика Бурятия;г. Улан-Удэ|Республика Бурятия;7707049388',
    ].join("\n");

    const collected: Array<{ region: string; garTerritory: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          region: row.region,
          garTerritory: row.garTerritory,
        });
      }
    });

    expect(collected).toEqual([
      {
        region: "Республика Бурятия",
        garTerritory: "г. Улан-Удэ|Республика Бурятия",
      },
    ]);
  });

  it("trims whitespace from region and GAR", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      "301;2110000;2114999;5000;Op;  Вологодская обл. ;  м.р-н Никольский ;123",
    ].join("\n");

    const collected: Array<{ region: string; garTerritory: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          region: row.region,
          garTerritory: row.garTerritory,
        });
      }
    });

    expect(collected[0]).toEqual({
      region: "Вологодская обл.",
      garTerritory: "м.р-н Никольский",
    });
  });

  it("preserves special federal city GAR strings as-is", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      "495;1000000;1000999;1000;Op;ГФЗ Москва;Город Москва;7707049388",
      "812;2000000;2000999;1000;Op;ГФЗ Санкт-Петербург;Город Санкт-Петербург;7707049388",
    ].join("\n");

    const collected: Array<{ region: string; garTerritory: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          region: row.region,
          garTerritory: row.garTerritory,
        });
      }
    });

    expect(collected).toEqual([
      { region: "ГФЗ Москва", garTerritory: "Город Москва" },
      {
        region: "ГФЗ Санкт-Петербург",
        garTerritory: "Город Санкт-Петербург",
      },
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

  it("allows empty region and GAR", async () => {
    const csv = [
      "ABC;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН",
      "301;2110000;2114999;5000;Op;;;",
    ].join("\n");

    const collected: Array<{ region: string; garTerritory: string }> = [];
    await parseCsvStream(Readable.from([csv]), async (rows) => {
      for (const row of rows) {
        collected.push({
          region: row.region,
          garTerritory: row.garTerritory,
        });
      }
    });

    expect(collected[0]).toEqual({ region: "", garTerritory: "" });
  });
});
