import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { basename } from "node:path";
import { parse } from "csv-parse";
import { normalizeInn } from "@/lib/inn/normalizeInn";
import { importPool } from "@/packages/db";

type OprRow = {
  id_src: string;
  opr_name: string;
  opr_nick: string;
  inn: string;
  bdpn_code: string;
  name_brand: string;
};

export async function importOprRegisterFromFile(
  filePath: string
): Promise<number> {
  await access(filePath);

  const sourceFile = basename(filePath);
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

  const client = await importPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM operators_register WHERE source_file = $1", [
      sourceFile,
    ]);

    for (const row of rows) {
      const inn = normalizeInn(row.inn);
      if (!inn) continue;

      await client.query(
        `
        INSERT INTO operators_register (
          id_src, opr_name, opr_nick, inn, bdpn_code, name_brand, source_file
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id_src) DO UPDATE SET
          opr_name = EXCLUDED.opr_name,
          opr_nick = EXCLUDED.opr_nick,
          inn = EXCLUDED.inn,
          bdpn_code = EXCLUDED.bdpn_code,
          name_brand = EXCLUDED.name_brand,
          source_file = EXCLUDED.source_file,
          loaded_at = now()
      `,
        [
          Number(row.id_src),
          row.opr_name.trim(),
          row.opr_nick.trim(),
          inn,
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
    client.release();
  }
}

export async function tryImportOprFromEnvPath(): Promise<number | null> {
  const filePath = process.env.OPR_CSV_PATH?.trim();
  if (!filePath) return null;

  try {
    const count = await importOprRegisterFromFile(filePath);
    console.warn(`Imported ${count} OPR operators from ${filePath}`);
    return count;
  } catch (error) {
    console.warn(
      `OPR import skipped (${filePath}):`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
