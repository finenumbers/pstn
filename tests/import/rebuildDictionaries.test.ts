import { beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/packages/db";
import { rebuildDictionaries } from "@/packages/import/csvLoader";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("rebuildDictionaries", () => {
  let runIsolatedCase = false;

  beforeAll(async () => {
    runIsolatedCase = process.env.TEST_REBUILD_DICTS === "1";
  });

  it("deduplicates operators that share a name with different INNs", async (ctx) => {
    if (!runIsolatedCase) {
      ctx.skip();
    }

    const client = pool();

    await client.query(`
      TRUNCATE TABLE
        number_ranges,
        number_ranges_staging,
        operators_dict,
        regions_dict,
        gar_territories_dict,
        abc_dict
      RESTART IDENTITY
    `);

    await client.query(`
      INSERT INTO number_ranges (
        abc, range_start, range_end, capacity, operator,
        gar_territory, region, inn, source_file
      ) VALUES
        ('495', 1000000, 1000999, 1000, 'ООО "ЛИНК"', 'City', 'Region', '1111111111', 'test'),
        ('495', 1001000, 1001999, 1000, 'ООО "ЛИНК"', 'City', 'Region', '2222222222', 'test')
    `);

    await expect(rebuildDictionaries()).resolves.toBeUndefined();

    const operators = await client.query<{ name: string; count: string }>(
      `SELECT name, COUNT(*)::text AS count FROM operators_dict GROUP BY name`
    );
    expect(operators.rows).toEqual([{ name: 'ООО "ЛИНК"', count: "1" }]);
  });
});
