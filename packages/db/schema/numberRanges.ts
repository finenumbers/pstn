import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const numberRanges = pgTable(
  "number_ranges",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    abc: varchar("abc", { length: 3 }).notNull(),
    rangeStart: bigint("range_start", { mode: "number" }).notNull(),
    rangeEnd: bigint("range_end", { mode: "number" }).notNull(),
    capacity: integer("capacity").notNull(),
    operator: text("operator").notNull(),
    settlement: text("settlement").notNull(),
    region: text("region").notNull(),
    inn: varchar("inn", { length: 12 }).notNull().default(""),
    abcGapBefore: boolean("abc_gap_before").notNull().default(false),
    abcGapAfter: boolean("abc_gap_after").notNull().default(false),
    sourceFile: varchar("source_file", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("chk_range_order", sql`${table.rangeEnd} >= ${table.rangeStart}`),
  ]
);

export const numberRangesStaging = pgTable(
  "number_ranges_staging",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    abc: varchar("abc", { length: 3 }).notNull(),
    rangeStart: bigint("range_start", { mode: "number" }).notNull(),
    rangeEnd: bigint("range_end", { mode: "number" }).notNull(),
    capacity: integer("capacity").notNull(),
    operator: text("operator").notNull(),
    settlement: text("settlement").notNull(),
    region: text("region").notNull(),
    inn: varchar("inn", { length: 12 }).notNull().default(""),
    abcGapBefore: boolean("abc_gap_before").notNull().default(false),
    abcGapAfter: boolean("abc_gap_after").notNull().default(false),
    sourceFile: varchar("source_file", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("number_ranges_staging_range_order", sql`${table.rangeEnd} >= ${table.rangeStart}`),
  ]
);

export const operatorsDict = pgTable("operators_dict", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  inn: varchar("inn", { length: 12 }).notNull().default(""),
});

export const regionsDict = pgTable("regions_dict", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const settlementsDict = pgTable("settlements_dict", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const abcDict = pgTable("abc_dict", {
  code: varchar("code", { length: 3 }).primaryKey(),
});

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: varchar("status", { length: 20 }).notNull(),
  triggeredBy: varchar("triggered_by", { length: 20 }).default("manual"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  rowsLoaded: integer("rows_loaded").default(0),
  errorMessage: text("error_message"),
  progressPhase: varchar("progress_phase", { length: 64 }),
  filesProcessed: integer("files_processed").default(0),
  filesTotal: integer("files_total").default(4),
  fileRows: jsonb("file_rows")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const datasetMeta = pgTable("dataset_meta", {
  id: smallint("id").primaryKey().default(1),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastJobId: uuid("last_job_id"),
  totalRows: integer("total_rows"),
  totalCapacity: bigint("total_capacity", { mode: "number" }),
  uniqueOperators: integer("unique_operators"),
});
