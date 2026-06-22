import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { parse } from "csv-parse";
import pg from "pg";

type OprRow = {
  id_src: string;
  opr_name: string;
  opr_nick: string;
  inn: string;
  bdpn_code: string;
  name_brand: string;
};

async function importOprCsv(filePath: string): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sourceFile = basename(filePath);
  const client = new pg.Client({ connectionString });
  await client.connect();

  const rows: OprRow[] = [];
  const parser = parse({
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  await new Promise<void>((resolve, reject) => {
    createReadStream(filePath)
      .pipe(parser)
      .on("data", (record: OprRow) => rows.push(record))
      .on("error", reject)
      .on("end", resolve);
  });

  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM operators_register WHERE source_file = $1", [
      sourceFile,
    ]);

    for (const row of rows) {
      await client.query(
        `
        INSERT INTO operators_register (
          id_src, opr_name, opr_nick, inn, bdpn_code, name_brand, source_file
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [
          Number(row.id_src),
          row.opr_name.trim(),
          row.opr_nick.trim(),
          row.inn.trim(),
          (row.bdpn_code ?? "").trim(),
          (row.name_brand ?? "").trim(),
          sourceFile,
        ]
      );
    }

    await client.query("COMMIT");
    return rows.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function printSummary(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

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

    const emergency = await client.query(`
      SELECT id_src, opr_name, inn
      FROM operators_register
      WHERE inn LIKE '%9999999'
      ORDER BY id_src
      LIMIT 10
    `);

    const rostelecom = await client.query(`
      SELECT id_src, opr_nick, inn, bdpn_code
      FROM operators_register
      WHERE opr_name ILIKE '%ростелеком%'
      ORDER BY id_src
      LIMIT 5
    `);

    const bdpnSample = await client.query(`
      SELECT id_src, opr_nick, inn, bdpn_code
      FROM operators_register
      WHERE bdpn_code <> ''
      ORDER BY id_src
      LIMIT 10
    `);

    const row = totals.rows[0];
    console.log("\n=== operators_register ===");
    console.log(`Source: ${row?.source_file ?? "—"}`);
    console.log(`Total operators: ${row?.total ?? 0}`);
    console.log(`With bdpn_code: ${row?.with_bdpn ?? 0}`);
    console.log(`With name_brand: ${row?.with_brand ?? 0}`);

    console.log("\nEmergency services (sample):");
    console.table(emergency.rows);

    console.log("\nRostelecom (sample):");
    console.table(rostelecom.rows);

    console.log("\nRows with bdpn_code (sample):");
    console.table(bdpnSample.rows);
  } finally {
    await client.end();
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx scripts/import-opr-csv.ts <path-to-opr.csv>");
  process.exit(1);
}

importOprCsv(filePath)
  .then(async (count) => {
    console.log(`Imported ${count} operators from ${basename(filePath)}`);
    await printSummary();
  })
  .catch((error) => {
    console.error("OPR import failed:", error);
    process.exit(1);
  });
