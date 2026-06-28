/**
 * Baseline EXPLAIN (ANALYZE, BUFFERS) for typical phone mask searches.
 * Usage: DATABASE_URL=... tsx scripts/explain-phone-search.ts
 */
import pg from "pg";

const MASKS = [
  { label: "full_abc_partial_sub", mask: "3833999___" },
  { label: "partial_abc", mask: "499_66____" },
  { label: "subscriber_only", mask: "____777777" },
] as const;

async function explainMask(
  client: pg.Client,
  label: string,
  mask: string
): Promise<void> {
  const parts = mask.match(/^(.{3})(.{7})$/)!;
  const abc = parts[1];
  const sub = parts[2];

  let subscriberMin = 0;
  let subscriberMax = 0;
  for (let index = 0; index < 7; index++) {
    const slot = sub[index] ?? "_";
    const minDigit = slot === "_" ? 0 : Number(slot);
    const maxDigit = slot === "_" ? 9 : Number(slot);
    const power = 10 ** (6 - index);
    subscriberMin += minDigit * power;
    subscriberMax += maxDigit * power;
  }

  const abcCodes: string[] = [];
  function expand(index: number, prefix: string) {
    if (index === 3) {
      abcCodes.push(prefix);
      return;
    }
    const slot = abc[index] ?? "_";
    if (slot !== "_") {
      expand(index + 1, prefix + slot);
    } else {
      for (let digit = 0; digit <= 9; digit++) {
        expand(index + 1, prefix + String(digit));
      }
    }
  }
  expand(0, "");

  const abcFilter =
    abcCodes.length === 1
      ? `abc = '${abcCodes[0]}'`
      : abcCodes.length > 0 && abcCodes.length <= 1000
        ? `abc IN (${abcCodes.map((code) => `'${code}'`).join(", ")})`
        : "TRUE";

  const allSubFixed = !sub.includes("_");
  const overlapSql = allSubFixed
    ? `range_start <= ${subscriberMin} AND range_end >= ${subscriberMin}`
    : `range_start <= ${subscriberMax}
       AND range_end >= ${subscriberMin}
       AND phone_mask_overlaps(range_start, range_end, '${mask}')`;

  const sql = `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id
FROM number_ranges
WHERE ${abcFilter}
  AND ${overlapSql}
ORDER BY abc, range_start
LIMIT 50;
`;

  console.log(`\n=== ${label} (${mask}) ===\n`);
  const result = await client.query(sql);
  for (const row of result.rows) {
    console.log(row["QUERY PLAN"]);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    for (const { label, mask } of MASKS) {
      await explainMask(client, label, mask);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
