import { eq } from "drizzle-orm";
import { db, importPool } from "@/packages/db";
import { importJobs, partyAddresses } from "@/packages/db/schema";
import type { ParsedPartyAddress } from "@/lib/dadata/parsePartyAddress";
import {
  findPartyAddress,
  PartyHttpError,
  readDadataApiKey,
  type EnrichStopReason,
} from "./dadataPartyClient";

const INN_PATTERN = "^[0-9]{10}$|^[0-9]{12}$";
const CONCURRENCY = 2;
const MIN_INTERVAL_MS = 100;
const MAX_DURATION_MS = 20 * 60 * 1000;
const RETRIES = 2;
const FLUSH_INTERVAL_MS = 1000;

export async function latestDiffSnapshotId(): Promise<string | null> {
  const result = await importPool().query<{ id: string }>(
    `SELECT id
     FROM dataset_snapshots
     ORDER BY load_date DESC, created_at DESC
     LIMIT 1`
  );
  return result.rows[0]?.id ?? null;
}

async function listPartyInns(
  snapshotId: string | null,
  missingOnly: boolean
): Promise<string[]> {
  const result = await importPool().query<{ inn: string }>(
    `
    SELECT s.inn
    FROM (
      SELECT inn
      FROM number_ranges
      WHERE inn ~ $2
      UNION
      SELECT inn
      FROM number_range_diffs
      WHERE $1::uuid IS NOT NULL
        AND snapshot_id = $1::uuid
        AND inn ~ $2
      UNION
      SELECT prev_inn AS inn
      FROM number_range_diffs
      WHERE $1::uuid IS NOT NULL
        AND snapshot_id = $1::uuid
        AND prev_inn ~ $2
    ) s
    LEFT JOIN party_addresses p ON p.inn = s.inn
    WHERE $3::boolean = false OR p.inn IS NULL
    ORDER BY s.inn
    `,
    [snapshotId, INN_PATTERN, missingOnly]
  );
  return result.rows.map((row) => row.inn);
}

async function writeEnrichProgress(
  jobId: string,
  progress: {
    total: number;
    done: number;
    withAddress: number;
    empty: number;
    stopReason: EnrichStopReason | null;
  }
): Promise<void> {
  await db
    .update(importJobs)
    .set({
      enrichTotal: progress.total,
      enrichDone: progress.done,
      enrichWithAddress: progress.withAddress,
      enrichEmpty: progress.empty,
      enrichStopReason: progress.stopReason,
      progressPhase: "enriching_legal_addresses",
      updatedAt: new Date(),
    })
    .where(eq(importJobs.id, jobId));
}

async function upsertPartyAddress(
  inn: string,
  parsed: ParsedPartyAddress
): Promise<void> {
  const legalAddress = parsed.kind === "ok" ? parsed.address : null;
  const status = parsed.kind === "ok" ? "ok" : parsed.kind;
  await db
    .insert(partyAddresses)
    .values({
      inn,
      legalAddress,
      status,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: partyAddresses.inn,
      set: {
        legalAddress,
        status,
        fetchedAt: new Date(),
      },
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function findWithRetries(
  inn: string,
  apiKey: string
): Promise<ParsedPartyAddress> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await findPartyAddress(inn, apiKey);
    } catch (error) {
      if (error instanceof PartyHttpError && error.stop) throw error;
      if (error instanceof PartyHttpError && !error.retryable) throw error;
      lastError = error;
      if (attempt < RETRIES) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("dadata request failed");
}

/**
 * Refreshes party_addresses for unique INNs.
 * full: every INN of the loaded dataset and its diff snapshot.
 * missing: only INNs that have no row yet (first deploy or an interrupted pass).
 * DaData failures stay inside this function and do not fail the import job.
 */
export async function enrichLegalAddresses(params: {
  jobId: string;
  mode: "full" | "missing";
  snapshotId: string | null;
}): Promise<void> {
  const inns = await listPartyInns(params.snapshotId, params.mode === "missing");
  const apiKey = readDadataApiKey();

  if (!apiKey) {
    if (params.mode === "missing" && inns.length === 0) return;
    await writeEnrichProgress(params.jobId, {
      total: 0,
      done: 0,
      withAddress: 0,
      empty: 0,
      stopReason: "missing_key",
    });
    console.warn("Legal address enrichment skipped: DADATA_API_KEY is not set");
    return;
  }

  if (inns.length === 0) return;

  const progress = {
    total: inns.length,
    done: 0,
    withAddress: 0,
    empty: 0,
    stopReason: null as EnrichStopReason | null,
  };
  await writeEnrichProgress(params.jobId, progress);

  const startedAt = Date.now();
  let nextSlot = 0;
  let lastFlush = Date.now();
  let cursor = 0;

  const pace = async () => {
    const now = Date.now();
    const start = Math.max(now, nextSlot);
    nextSlot = start + MIN_INTERVAL_MS;
    const wait = start - now;
    if (wait > 0) await sleep(wait);
  };

  const maybeFlush = async (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_INTERVAL_MS) return;
    lastFlush = now;
    await writeEnrichProgress(params.jobId, progress);
  };

  const worker = async () => {
    while (!progress.stopReason) {
      const index = cursor;
      cursor += 1;
      if (index >= inns.length) return;
      if (Date.now() - startedAt > MAX_DURATION_MS) {
        progress.stopReason = "timeout";
        return;
      }

      const inn = inns[index]!;
      try {
        await pace();
        if (progress.stopReason) return;
        const parsed = await findWithRetries(inn, apiKey);
        await upsertPartyAddress(inn, parsed);
        progress.done += 1;
        if (parsed.kind === "ok") progress.withAddress += 1;
        else progress.empty += 1;
      } catch (error) {
        if (error instanceof PartyHttpError && error.stop) {
          progress.stopReason = error.stop;
          console.info(
            `enrich legal address stopped inn=${inn} status=${error.message} done=${progress.done} total=${progress.total}`
          );
          return;
        }
        progress.done += 1;
        console.info(
          `enrich legal address inn=${inn} status=error done=${progress.done} total=${progress.total}`
        );
      }
      await maybeFlush(false);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, inns.length) }, () => worker())
  );
  await maybeFlush(true);
  console.info(
    `enrich legal addresses done=${progress.done} total=${progress.total} withAddress=${progress.withAddress} empty=${progress.empty} stop=${progress.stopReason ?? "none"}`
  );
}
