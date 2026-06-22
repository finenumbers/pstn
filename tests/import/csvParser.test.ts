import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import {
  normalizeMunicipalDistrictOrder,
  normalizeRegionAbbreviation,
  normalizeSettlement,
  parseCsvStream,
  parseGarTerritory,
  resolveTerritory,
} from "@/packages/import/csvParser";

describe("normalizeSettlement", () => {
  it("removes г. prefix", () => {
    expect(normalizeSettlement("г. Улан-Удэ")).toBe("Улан-Удэ");
    expect(normalizeSettlement("г. Москва")).toBe("Москва");
  });

  it("removes г.о. prefix", () => {
    expect(normalizeSettlement("г.о. Нижнесергинское")).toBe("Нижнесергинское");
  });

  it("removes г.о. город prefix", () => {
    expect(normalizeSettlement("г.о. город Улан-Удэ")).toBe("Улан-Удэ");
  });

  it("removes г.о. город-курорт prefix", () => {
    expect(normalizeSettlement("г.о. город-курорт Анапа")).toBe("Анапа");
  });

  it("removes город-герой prefix", () => {
    expect(normalizeSettlement("город-герой Волгоград")).toBe("Волгоград");
  });

  it("prefers longest matching prefix", () => {
    expect(normalizeSettlement("г.о. город Семилуки")).toBe("Семилуки");
  });
});

describe("parseGarTerritory", () => {
  it("splits settlement and region by single pipe", () => {
    expect(parseGarTerritory("г. Улан-Удэ|Республика Бурятия")).toEqual({
      settlement: "г. Улан-Удэ",
      region: "Республика Бурятия",
    });
  });

  it("uses first segment as settlement and last as region when multiple pipes", () => {
    expect(
      parseGarTerritory(
        "г. Улан-Удэ|г.о. город Улан-Удэ|Республика Бурятия"
      )
    ).toEqual({
      settlement: "г. Улан-Удэ",
      region: "Республика Бурятия",
    });
  });

  it("ignores middle segments for four-part GAR values", () => {
    expect(
      parseGarTerritory(
        "г. Семилуки|г.п. город Семилуки|м.р-н Семилукский|Воронежская область"
      )
    ).toEqual({
      settlement: "г. Семилуки",
      region: "Воронежская область",
    });
  });

  it("maps federal cities to GFZ regions before settlement normalization", () => {
    expect(parseGarTerritory("Город Москва")).toEqual({
      settlement: "г. Москва",
      region: "ГФЗ Москва",
    });
    expect(parseGarTerritory("Город Санкт-Петербург")).toEqual({
      settlement: "г. Санкт-Петербург",
      region: "ГФЗ Санкт-Петербург",
    });
    expect(parseGarTerritory("Город Севастополь")).toEqual({
      settlement: "г. Севастополь",
      region: "ГФЗ Севастополь",
    });
  });

  it("maps Baikonur and Russian Federation to both settlement and region", () => {
    expect(parseGarTerritory("Город Байконур")).toEqual({
      settlement: "Байконур",
      region: "Байконур",
    });
    expect(parseGarTerritory("Российская Федерация")).toEqual({
      settlement: "Российская Федерация",
      region: "Российская Федерация",
    });
  });

  it("puts value without pipe into region only", () => {
    expect(parseGarTerritory("Республика Бурятия")).toEqual({
      settlement: "",
      region: "Республика Бурятия",
    });
  });

  it("returns empty strings for empty input", () => {
    expect(parseGarTerritory("")).toEqual({ settlement: "", region: "" });
  });
});

describe("normalizeRegionAbbreviation", () => {
  it("expands обл. to область", () => {
    expect(normalizeRegionAbbreviation("Вологодская обл.")).toBe(
      "Вологодская область"
    );
  });
});

describe("normalizeMunicipalDistrictOrder", () => {
  it("moves trailing м.р-н to the front", () => {
    expect(normalizeMunicipalDistrictOrder("Междуреченский м.р-н")).toBe(
      "м.р-н Междуреченский"
    );
  });

  it("leaves already prefixed values unchanged", () => {
    expect(normalizeMunicipalDistrictOrder("м.р-н Никольский")).toBe(
      "м.р-н Никольский"
    );
  });
});

describe("resolveTerritory", () => {
  it("uses CSV region when GAR region contains м.р-н", () => {
    expect(
      resolveTerritory("м.р-н Никольский", "р-н Никольский|Вологодская обл.")
    ).toEqual({
      settlement: "р-н Никольский",
      region: "Вологодская область",
    });
  });

  it("reorders settlement when CSV part ends with м.р-н", () => {
    expect(
      resolveTerritory(
        "Междуреченский м.р-н",
        "Междуреченский м.р-н|Кемеровская обл."
      )
    ).toEqual({
      settlement: "м.р-н Междуреченский",
      region: "Кемеровская область",
    });
  });

  it("keeps GAR parsing when region has no м.р-н", () => {
    expect(
      resolveTerritory(
        "г. Улан-Удэ|Республика Бурятия",
        "ignored|ignored"
      )
    ).toEqual({
      settlement: "Улан-Удэ",
      region: "Республика Бурятия",
    });
  });

  it("falls back to GAR when CSV region has no pipe", () => {
    expect(resolveTerritory("м.р-н Никольский", "ignored")).toEqual({
      settlement: "",
      region: "м.р-н Никольский",
    });
  });
});

describe("parseCsvStream", () => {
  it("parses operator names with embedded quotes and normalizes settlement", async () => {
    const csv = `АВС/ DEF;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН
301;2110000;2129999;20000;ПАО "Ростелеком";ignored region;г. Улан-Удэ|г.о. город Улан-Удэ|Республика Бурятия;7707049388
`;

    const collected: Array<{
      operator: string;
      settlement: string;
      region: string;
      inn: string;
    }> = [];

    const result = await parseCsvStream(Readable.from([csv]), async (batch) => {
      for (const row of batch) {
        collected.push({
          operator: row.operator,
          settlement: row.settlement,
          region: row.region,
          inn: row.inn,
        });
      }
    });

    expect(result.loaded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(collected[0].operator).toBe('ПАО "Ростелеком"');
    expect(collected[0].settlement).toBe("Улан-Удэ");
    expect(collected[0].region).toBe("Республика Бурятия");
    expect(collected[0].inn).toBe("7707049388");
  });

  it("normalizes federal city settlements on import", async () => {
    const csv = `АВС/ DEF;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН
495;1000000;1009999;10000;Оператор;ignored;Город Москва;1234567890
`;

    const collected: Array<{ settlement: string; region: string }> = [];

    await parseCsvStream(Readable.from([csv]), async (batch) => {
      for (const row of batch) {
        collected.push({ settlement: row.settlement, region: row.region });
      }
    });

    expect(collected).toEqual([
      { settlement: "Москва", region: "ГФЗ Москва" },
    ]);
  });

  it("loads Baikonur and Russian Federation on import", async () => {
    const csv = `АВС/ DEF;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН
336;1000000;1009999;10000;Оператор;ignored;Город Байконур;1234567890
900;2000000;2009999;10000;Оператор;ignored;Российская Федерация;1234567891
`;

    const collected: Array<{ settlement: string; region: string }> = [];

    await parseCsvStream(Readable.from([csv]), async (batch) => {
      for (const row of batch) {
        collected.push({ settlement: row.settlement, region: row.region });
      }
    });

    expect(collected).toEqual([
      { settlement: "Байконур", region: "Байконур" },
      {
        settlement: "Российская Федерация",
        region: "Российская Федерация",
      },
    ]);
  });

  it("loads GAR without pipe entirely into region", async () => {
    const csv = `АВС/ DEF;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН
301;2110000;2129999;20000;Оператор;ignored;Республика Бурятия;1234567890
`;

    const collected: Array<{ settlement: string; region: string }> = [];

    await parseCsvStream(Readable.from([csv]), async (batch) => {
      for (const row of batch) {
        collected.push({ settlement: row.settlement, region: row.region });
      }
    });

    expect(collected).toHaveLength(1);
    expect(collected[0]).toEqual({
      settlement: "",
      region: "Республика Бурятия",
    });
  });

  it("uses CSV region for м.р-н-only GAR values from MinDigital", async () => {
    const csv = `АВС/ DEF;От;До;Емкость;Оператор;Регион;Территория ГАР;ИНН
817;5421000;5422999;2000;ПАО "Ростелеком";р-н Никольский|Вологодская обл.;м.р-н Никольский;7707049388
817;4921000;4921999;1000;ПАО "Ростелеком";р-н Междуреченский|Вологодская обл.;Междуреченский м.р-н;7707049388
`;

    const collected: Array<{ settlement: string; region: string }> = [];

    await parseCsvStream(Readable.from([csv]), async (batch) => {
      for (const row of batch) {
        collected.push({ settlement: row.settlement, region: row.region });
      }
    });

    expect(collected).toEqual([
      { settlement: "р-н Никольский", region: "Вологодская область" },
      { settlement: "р-н Междуреченский", region: "Вологодская область" },
    ]);
  });
});
