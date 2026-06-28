import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
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
    region: text("region").notNull(),
    garTerritory: text("gar_territory").notNull(),
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
    region: text("region").notNull(),
    garTerritory: text("gar_territory").notNull(),
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

export const operatorsRegister = pgTable("operators_register", {
  idSrc: integer("id_src").primaryKey(),
  oprName: text("opr_name").notNull(),
  oprNick: text("opr_nick").notNull(),
  inn: varchar("inn", { length: 12 }).notNull().unique(),
  bdpnCode: text("bdpn_code").notNull().default(""),
  nameBrand: text("name_brand").notNull().default(""),
  sourceFile: text("source_file").notNull().default(""),
  loadedAt: timestamp("loaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const regionsDict = pgTable("regions_dict", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const garTerritoriesDict = pgTable("gar_territories_dict", {
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
  skipReason: varchar("skip_reason", { length: 64 }),
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
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const datasetMeta = pgTable("dataset_meta", {
  id: smallint("id").primaryKey().default(1),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastJobId: uuid("last_job_id"),
  totalRows: integer("total_rows"),
  totalCapacity: bigint("total_capacity", { mode: "number" }),
  uniqueOperators: integer("unique_operators"),
  uniqueRegions: integer("unique_regions"),
  uniqueGarTerritories: integer("unique_gar_territories"),
  sourceHashes: jsonb("source_hashes").$type<Record<string, string>>(),
});

export const datasetSnapshots = pgTable("dataset_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: varchar("kind", { length: 16 }).notNull().default("diff"),
  loadDate: date("load_date").notNull(),
  jobId: uuid("job_id"),
  addedCount: integer("added_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  removedCount: integer("removed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const numberRangeDiffs = pgTable(
  "number_range_diffs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    snapshotId: uuid("snapshot_id").notNull(),
    changeType: varchar("change_type", { length: 16 }).notNull(),
    abc: varchar("abc", { length: 3 }).notNull(),
    rangeStart: bigint("range_start", { mode: "number" }).notNull(),
    rangeEnd: bigint("range_end", { mode: "number" }).notNull(),
    capacity: integer("capacity").notNull(),
    operator: text("operator").notNull(),
    region: text("region").notNull(),
    garTerritory: text("gar_territory").notNull(),
    inn: varchar("inn", { length: 12 }).notNull().default(""),
    prevRangeStart: bigint("prev_range_start", { mode: "number" }),
    prevRangeEnd: bigint("prev_range_end", { mode: "number" }),
    prevCapacity: integer("prev_capacity"),
    prevOperator: text("prev_operator"),
    prevRegion: text("prev_region"),
    prevGarTerritory: text("prev_gar_territory"),
    prevInn: varchar("prev_inn", { length: 12 }),
  },
  (table) => [
    check(
      "number_range_diffs_range_order",
      sql`${table.rangeEnd} >= ${table.rangeStart}`
    ),
  ]
);
