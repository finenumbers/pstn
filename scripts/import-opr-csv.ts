import { importOprRegisterFromFile } from "@/packages/import/importOprRegister";
import pg from "pg";

async function printSummary(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const totals = await client.query<{
      total: string;
      with_bdpn: string;
      with_brand: string;
      source_file: string;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE bdpn_code <> '')::text AS with_bdpn,
        COUNT(*) FILTER (WHERE name_brand <> '')::text AS with_brand,
        MIN(source_file) AS source_file
      FROM operators_register
    `);

    const matched = await client.query<{ matched: string }>(`
      SELECT COUNT(DISTINCT regexp_replace(nr.inn, '\\D', '', 'g'))::text AS matched
      FROM number_ranges nr
      INNER JOIN operators_register op
        ON regexp_replace(nr.inn, '\\D', '', 'g') = regexp_replace(op.inn, '\\D', '', 'g')
      WHERE regexp_replace(nr.inn, '\\D', '', 'g') <> ''
    `);

    const row = totals.rows[0];
    console.log("\n=== operators_register ===");
    console.log(`Source: ${row?.source_file ?? "—"}`);
    console.log(`Total operators: ${row?.total ?? 0}`);
    console.log(`With bdpn_code: ${row?.with_bdpn ?? 0}`);
    console.log(`With name_brand: ${row?.with_brand ?? 0}`);
    console.log(`Matched distinct INNs in number_ranges: ${matched.rows[0]?.matched ?? 0}`);
  } finally {
    await client.end();
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx scripts/import-opr-csv.ts <path-to-opr.csv>");
  process.exit(1);
}

importOprRegisterFromFile(filePath)
  .then(async (count) => {
    console.log(`Imported ${count} OPR rows from ${filePath}`);
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      await printSummary(connectionString);
    }
  })
  .catch((error) => {
    console.error("OPR import failed:", error);
    process.exit(1);
  });
