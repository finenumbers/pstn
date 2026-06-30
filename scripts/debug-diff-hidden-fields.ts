/**
 * One-off debug: inspect diff rows where operator/INN look unchanged in UI.
 * Usage:
 *   DATABASE_URL='postgresql://...' npx tsx scripts/debug-diff-hidden-fields.ts
 *   DATABASE_URL='...' npx tsx scripts/debug-diff-hidden-fields.ts --load-date=2026-06-30 --abc=343
 */
import { appendFileSync } from "node:fs";
import pg from "pg";

const LOG_PATH =
  "/Users/dvpershin/Work/PSTN/.cursor/debug-bcdc45.log";
const INGEST =
  "http://127.0.0.1:7812/ingest/db1027e1-b60b-480f-a94e-2c390e7035f8";
const SESSION = "bcdc45";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

type DiffRow = {
  load_date: string;
  abc: string;
  range_start: string;
  range_end: string;
  capacity: number;
  change_type: string;
  operator: string;
  prev_operator: string | null;
  inn: string;
  prev_inn: string | null;
  region: string;
  prev_region: string | null;
  gar_territory: string;
  prev_gar_territory: string | null;
  prev_range_start: string | null;
  prev_range_end: string | null;
};

function analyze(row: DiffRow) {
  const uiOldOperator = row.prev_operator ?? row.operator;
  const uiNewOperator = row.operator;
  const uiOldInn = row.prev_inn ?? row.inn;
  const uiNewInn = row.inn;
  const uiOperatorInnSame =
    uiOldOperator === uiNewOperator && uiOldInn === uiNewInn;

  const differingFields: string[] = [];
  if (row.region !== row.prev_region) differingFields.push("region");
  if (row.gar_territory !== row.prev_gar_territory) {
    differingFields.push("garTerritory");
  }
  if (String(row.range_start) !== String(row.prev_range_start)) {
    differingFields.push("rangeStart");
  }
  if (String(row.range_end) !== String(row.prev_range_end)) {
    differingFields.push("rangeEnd");
  }

  const hypothesisIds = [
    differingFields.length > 0 ? "H-A" : null,
    row.prev_operator == null || row.prev_inn == null ? "H-B" : null,
    row.operator !== (row.prev_operator ?? row.operator) ||
    row.inn !== (row.prev_inn ?? row.inn)
      ? "H-C"
      : null,
    differingFields.length === 0 && uiOperatorInnSame ? "H-E" : null,
  ].filter(Boolean);

  return {
    uiOperatorInnSame,
    differingFields,
    hypothesisId: hypothesisIds.join(","),
    region: row.region,
    prevRegion: row.prev_region,
    garTerritory: row.gar_territory,
    prevGarTerritory: row.prev_gar_territory,
    prevOperatorNull: row.prev_operator == null,
    prevInnNull: row.prev_inn == null,
  };
}

async function emitLog(row: DiffRow, analysis: ReturnType<typeof analyze>) {
  const payload = {
    sessionId: SESSION,
    runId: "pre-fix",
    hypothesisId: analysis.hypothesisId,
    location: "scripts/debug-diff-hidden-fields.ts",
    message: "diff row DB inspection",
    data: {
      loadDate: row.load_date,
      abc: row.abc,
      rangeStart: Number(row.range_start),
      rangeEnd: Number(row.range_end),
      capacity: row.capacity,
      changeType: row.change_type,
      operator: row.operator,
      prevOperator: row.prev_operator,
      inn: row.inn,
      prevInn: row.prev_inn,
      ...analysis,
    },
    timestamp: Date.now(),
  };

  appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`);
  await fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Set DATABASE_URL (from Portainer stack env).");
    process.exit(1);
  }

  const loadDate = arg("load-date", "2026-06-30");
  const abc = arg("abc", "343");

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query<DiffRow>(
      `
      SELECT
        s.load_date::text AS load_date,
        d.abc,
        d.range_start::text AS range_start,
        d.range_end::text AS range_end,
        d.capacity,
        d.change_type,
        d.operator,
        d.prev_operator,
        d.inn,
        d.prev_inn,
        d.region,
        d.prev_region,
        d.gar_territory,
        d.prev_gar_territory,
        d.prev_range_start::text AS prev_range_start,
        d.prev_range_end::text AS prev_range_end
      FROM number_range_diffs d
      INNER JOIN dataset_snapshots s ON s.id = d.snapshot_id
      WHERE s.has_diff = true
        AND s.load_date = $1::date
        AND d.abc = $2
        AND d.change_type = 'changed'
      ORDER BY d.range_start
      LIMIT 20
    `,
      [loadDate, abc]
    );

    if (result.rows.length === 0) {
      console.log(`No changed diff rows for abc=${abc} on ${loadDate}.`);
      return;
    }

    console.log(`Found ${result.rows.length} changed row(s):\n`);
    for (const row of result.rows) {
      const analysis = analyze(row);
      await emitLog(row, analysis);
      console.log(
        `ABC ${row.abc} ${row.range_start}-${row.range_end} | differing: [${analysis.differingFields.join(", ") || "NONE"}]`
      );
      console.log(`  region:     "${row.prev_region ?? ""}" → "${row.region}"`);
      console.log(
        `  gar:        "${row.prev_gar_territory ?? ""}" → "${row.gar_territory}"`
      );
      console.log(
        `  operator:   "${row.prev_operator ?? row.operator}" → "${row.operator}"`
      );
      console.log(`  inn:        "${row.prev_inn ?? row.inn}" → "${row.inn}"`);
      console.log(`  hypotheses: ${analysis.hypothesisId || "—"}\n`);
    }

    console.log(`Logs written to ${LOG_PATH}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
