import { asc, eq, and } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/packages/db/index";
import { numberRanges } from "@/packages/db/schema/numberRanges";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("abc range gap columns", () => {
  it("marks gaps from full ABC order, not visible neighbors", async () => {
    const rows = await db
      .select({
        rangeStart: numberRanges.rangeStart,
        abcRangeGapBefore: numberRanges.abcGapBefore,
        abcRangeGapAfter: numberRanges.abcGapAfter,
      })
      .from(numberRanges)
      .where(eq(numberRanges.abc, "301"))
      .orderBy(asc(numberRanges.rangeStart));

    const inBand = rows.filter(
      (r) => r.rangeStart >= 2110000 && r.rangeStart <= 2200000
    );

    expect(inBand).toEqual([
      {
        rangeStart: 2110000,
        abcRangeGapBefore: false,
        abcRangeGapAfter: true,
      },
      {
        rangeStart: 2150000,
        abcRangeGapBefore: true,
        abcRangeGapAfter: true,
      },
      {
        rangeStart: 2180000,
        abcRangeGapBefore: true,
        abcRangeGapAfter: false,
      },
      {
        rangeStart: 2190000,
        abcRangeGapBefore: false,
        abcRangeGapAfter: true,
      },
      {
        rangeStart: 2191000,
        abcRangeGapBefore: true,
        abcRangeGapAfter: false,
      },
      {
        rangeStart: 2200000,
        abcRangeGapBefore: false,
        abcRangeGapAfter: false,
      },
    ]);
  });

  it("marks gap after MTT range when successor is hidden by operator filter", async () => {
    const [mtt219] = await db
      .select({
        abcRangeGapAfter: numberRanges.abcGapAfter,
      })
      .from(numberRanges)
      .where(
        and(
          eq(numberRanges.abc, "301"),
          eq(numberRanges.rangeStart, 2190000)
        )
      );

    expect(mtt219?.abcRangeGapAfter).toBe(true);
  });

  it("reads gap flags for 50 MTT rows within 100ms", async () => {
    const start = Date.now();
    await db
      .select({
        gapBefore: numberRanges.abcGapBefore,
        gapAfter: numberRanges.abcGapAfter,
      })
      .from(numberRanges)
      .where(eq(numberRanges.operator, "АО \"МТТ\""))
      .orderBy(asc(numberRanges.rangeStart))
      .limit(50);
    expect(Date.now() - start).toBeLessThan(100);
  });
});
