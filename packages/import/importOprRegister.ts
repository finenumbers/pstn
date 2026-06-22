import { createReadStream, existsSync } from "node:fs";
import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse } from "csv-parse";
import { normalizeInn } from "@/lib/inn/normalizeInn";
import { importPool } from "@/packages/db";
import {
  BUNDLED_OPR_CONTAINER_PATH,
  BUNDLED_OPR_FILENAME,
} from "./constants";

type OprRow = {
  id_src: string;
  opr_name: string;
  opr_nick: string;
  inn: string;
  bdpn_code: string;
  name_brand: string;
};

export function resolveOprCsvPath(): string | null {
  const envPath = process.env.OPR_CSV_PATH?.trim();
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  if (existsSync(BUNDLED_OPR_CONTAINER_PATH)) {
    return BUNDLED_OPR_CONTAINER_PATH;
  }

  const devPath = join(process.cwd(), "data", "opr", BUNDLED_OPR_FILENAME);
  if (existsSync(devPath)) {
    return devPath;
  }

  return envPath ?? null;
}

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

/** Loads bundled OPR (or OPR_CSV_PATH override) into operators_register. Idempotent per source_file. */
export async function ensureOprRegisterLoaded(): Promise<number | null> {
  const filePath = resolveOprCsvPath();
  if (!filePath) {
    return null;
  }

  try {
    const count = await importOprRegisterFromFile(filePath);
    console.warn(`Loaded ${count} OPR operators from ${filePath}`);
    return count;
  } catch (error) {
    console.warn(
      `OPR import failed (${filePath}):`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/** @deprecated Use ensureOprRegisterLoaded */
export async function tryImportOprFromEnvPath(): Promise<number | null> {
  return ensureOprRegisterLoaded();
}
