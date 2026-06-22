import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/packages/db";
import { seedTestFixture } from "@/packages/db/seedTestFixture";
import { clearStaging, insertBatch, swapStagingToProduction } from "@/packages/import/csvLoader";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("import staging swap", () => {
  afterAll(async () => {
    await seedTestFixture();
  }, 30_000);

  it("preserves production rows until swap and replaces them atomically", async () => {
    const client = pool();

    await client.query(`
      TRUNCATE TABLE number_ranges, number_ranges_staging RESTART IDENTITY
    `);
    await client.query(`
      INSERT INTO number_ranges (
        abc, range_start, range_end, capacity, operator,
        settlement, region, inn, source_file
      ) VALUES ('301', 1000000, 1000999, 1000, 'Old Operator', 'City', 'Region', '', 'prod')
    `);

    await clearStaging();
    await insertBatch(
      [
        {
          abc: "495",
          rangeStart: 2_000_000,
          rangeEnd: 2_000_999,
          capacity: 1_000,
          operator: "New Operator",
          settlement: "City",
          region: "Region",
          inn: "",
        },
      ],
      "test-fixture"
    );

    const beforeSwap = await client.query<{ operator: string }>(
      "SELECT operator FROM number_ranges"
    );
    expect(beforeSwap.rows[0]?.operator).toBe("Old Operator");

    await swapStagingToProduction();

    const afterSwap = await client.query<{ operator: string }>(
      "SELECT operator FROM number_ranges"
    );
    expect(afterSwap.rows).toHaveLength(1);
    expect(afterSwap.rows[0]?.operator).toBe("New Operator");

    const stagingCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM number_ranges_staging"
    );
    expect(stagingCount.rows[0]?.count).toBe("0");
  });
});
