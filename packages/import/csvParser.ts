import { parse } from "csv-parse";
import { Readable as NodeReadable } from "node:stream";

export interface ParsedRangeRow {
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  settlement: string;
  region: string;
  inn: string;
}

const SETTLEMENT_PREFIXES = [
  "г.о. город-курорт ",
  "г.о. город ",
  "город-герой ",
  "г.о. ",
  "г. ",
] as const;

/** Strip administrative type prefixes from settlement names. */
export function normalizeSettlement(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  for (const prefix of SETTLEMENT_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }

  return trimmed;
}

const SPECIAL_GAR_TERRITORIES: Record<
  string,
  { settlement: string; region: string }
> = {
  "Город Москва": { settlement: "г. Москва", region: "ГФЗ Москва" },
  "Город Санкт-Петербург": {
    settlement: "г. Санкт-Петербург",
    region: "ГФЗ Санкт-Петербург",
  },
  "Город Севастополь": {
    settlement: "г. Севастополь",
    region: "ГФЗ Севастополь",
  },
  "Город Байконур": { settlement: "Байконур", region: "Байконур" },
  "Российская Федерация": {
    settlement: "Российская Федерация",
    region: "Российская Федерация",
  },
};

/**
 * Split «Территория ГАР»:
 * - special city names → fixed settlement/region
 * - no "|" → all in region
 * - one "|" → before first → settlement, after last → region
 * - more than one "|" → before first → settlement, after last → region (middle ignored)
 */
export function parseGarTerritory(gar: string): {
  settlement: string;
  region: string;
} {
  const trimmed = gar.trim();
  if (!trimmed) {
    return { settlement: "", region: "" };
  }

  const special = SPECIAL_GAR_TERRITORIES[trimmed];
  if (special) {
    return special;
  }

  const pipeCount = (trimmed.match(/\|/g) ?? []).length;

  if (pipeCount === 0) {
    return { settlement: "", region: trimmed };
  }

  const firstPipe = trimmed.indexOf("|");
  const lastPipe = trimmed.lastIndexOf("|");

  return {
    settlement: trimmed.slice(0, firstPipe).trim(),
    region: trimmed.slice(lastPipe + 1).trim(),
  };
}

/** Expand «обл.» to «область» in subject names from CSV «Регион». */
export function normalizeRegionAbbreviation(region: string): string {
  return region.replace(/обл\./g, "область");
}

/** «Междуреченский м.р-н» → «м.р-н Междуреченский». */
export function normalizeMunicipalDistrictOrder(value: string): string {
  const trimmed = value.trim();
  const trailing = trimmed.match(/^(.+?)\s+м\.р-н\s*$/u);
  if (trailing) {
    return `м.р-н ${trailing[1].trim()}`;
  }
  return trimmed;
}

/** Split CSV «Регион»: before first | → settlement, after last | → region. */
export function parseCsvRegionColumn(csvRegion: string): {
  settlement: string;
  region: string;
} | null {
  const trimmed = csvRegion.trim();
  if (!trimmed.includes("|")) {
    return null;
  }

  const firstPipe = trimmed.indexOf("|");
  const lastPipe = trimmed.lastIndexOf("|");

  return {
    settlement: trimmed.slice(0, firstPipe).trim(),
    region: trimmed.slice(lastPipe + 1).trim(),
  };
}

/**
 * GAR-first territory; when parsed region contains «м.р-н», fall back to CSV «Регион».
 */
export function resolveTerritory(
  gar: string,
  csvRegion: string
): { settlement: string; region: string } {
  const fromGar = parseGarTerritory(gar);

  if (!fromGar.region.includes("м.р-н")) {
    return {
      settlement: normalizeSettlement(fromGar.settlement),
      region: fromGar.region,
    };
  }

  const fromCsv = parseCsvRegionColumn(csvRegion);
  if (!fromCsv) {
    return fromGar;
  }

  const settlement = normalizeSettlement(
    normalizeMunicipalDistrictOrder(fromCsv.settlement)
  );
  const region = normalizeRegionAbbreviation(fromCsv.region);

  return { settlement, region };
}

export interface CsvParseResult {
  /** Successfully parsed and accepted rows. */
  loaded: number;
  /** Data lines in CSV that could not be parsed — must be 0 for import. */
  skipped: number;
  /** Non-header data lines seen in the file (loaded + skipped). */
  dataLines: number;
}

export class CsvParseIncompleteError extends Error {
  constructor(
    message: string,
    readonly skipped: number,
    readonly dataLines: number
  ) {
    super(message);
    this.name = "CsvParseIncompleteError";
  }
}

export async function parseCsvStream(
  body: ReadableStream<Uint8Array> | NodeReadable,
  onBatch: (rows: ParsedRangeRow[]) => Promise<void>,
  batchSize = 5000
): Promise<CsvParseResult> {
  const nodeStream =
    body instanceof NodeReadable
      ? body
      : NodeReadable.fromWeb(body as import("stream/web").ReadableStream);

  let batch: ParsedRangeRow[] = [];
  let loaded = 0;
  let skipped = 0;
  let dataLines = 0;
  let isHeader = true;

  const parser = parse({
    delimiter: ";",
    relax_column_count: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  for await (const record of nodeStream.pipe(parser)) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    dataLines += 1;
    const row = mapRecord(record as string[]);
    if (!row) {
      skipped += 1;
      continue;
    }

    batch.push(row);
    if (batch.length >= batchSize) {
      await onBatch(batch);
      loaded += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await onBatch(batch);
    loaded += batch.length;
  }

  return { loaded, skipped, dataLines };
}

function mapRecord(record: string[]): ParsedRangeRow | null {
  if (record.length < 7) return null;

  const abc = record[0]?.trim();
  const rangeStart = parseInt(record[1]?.trim() ?? "", 10);
  const rangeEnd = parseInt(record[2]?.trim() ?? "", 10);
  const capacity = parseInt(record[3]?.trim() ?? "", 10);
  const operator = record[4]?.trim() ?? "";

  if (!abc || isNaN(rangeStart) || isNaN(rangeEnd) || isNaN(capacity)) {
    return null;
  }

  // Indices: 0=ABC, 1=От, 2=До, 3=Емкость, 4=Оператор, 5=Регион, 6=Территория ГАР, 7=ИНН
  const gar = record[6]?.trim() ?? "";
  const csvRegion = record[5]?.trim() ?? "";
  const { settlement, region } = resolveTerritory(gar, csvRegion);
  const innValue = (record[7]?.trim() ?? "").replace(/\D/g, "");

  return {
    abc,
    rangeStart,
    rangeEnd,
    capacity,
    operator,
    settlement,
    region,
    inn: innValue,
  };
}
