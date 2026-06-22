import { parse } from "csv-parse";
import { Readable as NodeReadable } from "node:stream";

export interface ParsedRangeRow {
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  region: string;
  garTerritory: string;
  inn: string;
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
  const region = record[5]?.trim() ?? "";
  const garTerritory = record[6]?.trim() ?? "";
  const innValue = (record[7]?.trim() ?? "").replace(/\D/g, "");

  return {
    abc,
    rangeStart,
    rangeEnd,
    capacity,
    operator,
    region,
    garTerritory,
    inn: innValue,
  };
}
