import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/packages/db";
import { importJobs } from "@/packages/db/schema";
import {
  recoverStaleImportJobs,
  STALE_IMPORT_JOB_MESSAGE,
} from "@/packages/import/recoverStaleImportJobs";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("recoverStaleImportJobs", () => {
  it("marks pending and running jobs as failed and clears staging", async () => {
    const [pendingJob] = await db
      .insert(importJobs)
      .values({ status: "pending", progressPhase: "pending" })
      .returning();

    const [runningJob] = await db
      .insert(importJobs)
      .values({ status: "running", progressPhase: "loading_ABC-3xx" })
      .returning();

    const recovered = await recoverStaleImportJobs();
    expect(recovered).toBeGreaterThanOrEqual(2);

    const pendingAfter = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, pendingJob.id));
    const runningAfter = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, runningJob.id));

    expect(pendingAfter[0]?.status).toBe("failed");
    expect(runningAfter[0]?.status).toBe("failed");
    expect(pendingAfter[0]?.errorMessage).toBe(STALE_IMPORT_JOB_MESSAGE);
    expect(runningAfter[0]?.errorMessage).toBe(STALE_IMPORT_JOB_MESSAGE);
  });
});
