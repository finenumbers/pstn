import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/packages/db";
import { importJobs } from "@/packages/db/schema";
import {
  recoverStaleImportJobs,
  STALE_IMPORT_JOB_MESSAGE,
} from "@/packages/import/recoverStaleImportJobs";
import { STALE_IMPORT_JOB_MS } from "@/packages/import/importJobConstants";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("recoverStaleImportJobs", () => {
  beforeAll(async () => {
    await db.delete(importJobs);
  }, 30_000);

  afterAll(async () => {
    await db.delete(importJobs);
  }, 30_000);

  it("marks only jobs older than stale threshold as failed", async () => {
    const [freshJob] = await db
      .insert(importJobs)
      .values({ status: "running", progressPhase: "loading_ABC-3xx" })
      .returning();

    const [staleJob] = await db
      .insert(importJobs)
      .values({ status: "running", progressPhase: "loading_DEF-9xx" })
      .returning();

    const staleAt = new Date(Date.now() - STALE_IMPORT_JOB_MS - 60_000);
    await db.execute(
      sql`UPDATE import_jobs SET updated_at = ${staleAt} WHERE id = ${staleJob.id}`
    );

    const recovered = await recoverStaleImportJobs();
    expect(recovered).toBe(1);

    const freshAfter = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, freshJob.id));
    const staleAfter = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, staleJob.id));

    expect(freshAfter[0]?.status).toBe("running");
    expect(staleAfter[0]?.status).toBe("failed");
    expect(staleAfter[0]?.errorMessage).toBe(STALE_IMPORT_JOB_MESSAGE);
  });
});
