import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/packages/db/index";
import {
  parsePhoneNumberMask,
  rangeMatchesPhoneMask,
  serializePhoneMask,
} from "@/lib/phoneNumberMask";
import {
  insertTestRangeRows,
  truncateRangeTables,
  type TestRangeRow,
} from "@/tests/helpers/dbTestIsolation";

const ROWS: TestRangeRow[] = [
  {
    abc: "383",
    rangeStart: 3_999_900,
    rangeEnd: 3_999_929,
    capacity: 30,
    operator: 'ООО "Match"',
    garTerritory: "Новосибирск",
    region: "Новосибирская область",
    inn: "5406978329",
  },
  {
    abc: "383",
    rangeStart: 3_884_000,
    rangeEnd: 3_902_999,
    capacity: 19_000,
    operator: 'ООО "No Match"',
    garTerritory: "Новосибирск",
    region: "Новосибирская область",
    inn: "7702340000",
  },
];

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("phone_mask_overlaps SQL parity", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows(ROWS);
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("matches JS rangeMatchesPhoneMask for partial mask rows", async () => {
    const mask = "3833999___";
    const parts = parsePhoneNumberMask(mask)!;

    const result = await db.execute<{ id: number; overlaps: boolean }>(sql`
      SELECT id,
        phone_mask_overlaps(range_start, range_end, ${mask}) AS overlaps
      FROM number_ranges
      ORDER BY id
    `);

    const matchingIds = result.rows
      .filter((row) => row.overlaps)
      .map((row) => row.id);
    expect(matchingIds.length).toBe(1);

    const matchedRow = ROWS[0]!;
    expect(
      rangeMatchesPhoneMask(
        matchedRow.rangeStart,
        matchedRow.rangeEnd,
        parts
      )
    ).toBe(true);
    expect(
      rangeMatchesPhoneMask(ROWS[1]!.rangeStart, ROWS[1]!.rangeEnd, parts)
    ).toBe(false);
  });

  it("returns false when phone_mask_overlaps has no intersection", async () => {
    const result = await db.execute<{ overlaps: boolean }>(sql`
      SELECT phone_mask_overlaps(2110000, 2129999, ${serializePhoneMask(
        parsePhoneNumberMask("777777")!.slots
      )}) AS overlaps
    `);
    expect(result.rows[0]?.overlaps).toBe(false);
  });
});
