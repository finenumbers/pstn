import { z } from "zod";

export const DATASET_CURRENT_ID = "current";

const uuidSchema = z.string().uuid("Invalid snapshot id");

const diffDatasetParamSchema = z
  .string()
  .refine((value) => value.startsWith("diff:"), "Diff dataset must use diff: prefix")
  .transform((value) => value.slice("diff:".length))
  .pipe(uuidSchema);

const fullDatasetParamSchema = z
  .string()
  .refine((value) => value.startsWith("full:"), "Full dataset must use full: prefix")
  .transform((value) => value.slice("full:".length))
  .pipe(uuidSchema);

export const datasetParamSchema = z
  .string()
  .optional()
  .transform((value) => value ?? DATASET_CURRENT_ID)
  .pipe(
    z.union([
      z.literal(DATASET_CURRENT_ID),
      diffDatasetParamSchema.transform((snapshotId) => `diff:${snapshotId}`),
      fullDatasetParamSchema.transform((snapshotId) => `full:${snapshotId}`),
    ])
  );

export const asOfParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
  .optional();

export type DatasetKind = "current" | "diff" | "full";

export interface DatasetRef {
  kind: DatasetKind;
  snapshotId?: string;
}

export interface DatasetListItem {
  id: string;
  kind: Exclude<DatasetKind, "full">;
  label: string;
  loadDate: string;
  stats?: {
    added: number;
    changed: number;
    removed: number;
  };
}

export interface DatasetChangeDateItem {
  loadDate: string;
  snapshotId: string;
  hasDiff: boolean;
}

export interface DatasetsResponse {
  items: DatasetListItem[];
}

export interface ChangeDatesResponse {
  items: DatasetChangeDateItem[];
}

export function parseDatasetParam(raw: string | null | undefined): DatasetRef {
  const parsed = datasetParamSchema.parse(raw ?? DATASET_CURRENT_ID);
  if (parsed === DATASET_CURRENT_ID) {
    return { kind: "current" };
  }
  if (parsed.startsWith("diff:")) {
    return { kind: "diff", snapshotId: parsed.slice("diff:".length) };
  }
  return { kind: "full", snapshotId: parsed.slice("full:".length) };
}

export function tryParseDatasetParam(
  raw: string | null | undefined
):
  | { success: true; data: DatasetRef }
  | { success: false; error: z.ZodError } {
  const result = datasetParamSchema.safeParse(raw ?? DATASET_CURRENT_ID);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (result.data === DATASET_CURRENT_ID) {
    return { success: true, data: { kind: "current" } };
  }
  if (result.data.startsWith("diff:")) {
    return {
      success: true,
      data: { kind: "diff", snapshotId: result.data.slice("diff:".length) },
    };
  }
  return {
    success: true,
    data: { kind: "full", snapshotId: result.data.slice("full:".length) },
  };
}

export function serializeDatasetParam(ref: DatasetRef): string {
  if (ref.kind === "current") return DATASET_CURRENT_ID;
  if (ref.kind === "diff") return `diff:${ref.snapshotId}`;
  return `full:${ref.snapshotId}`;
}

export function formatDatasetLabel(kind: DatasetKind, loadDate: string): string {
  const [year, month, day] = loadDate.split("-");
  const formatted = `${day}.${month}.${year}`;
  if (kind === "current") return `Датасет ${formatted}`;
  if (kind === "full") return `Датасет ${formatted}`;
  return `Расхождения ${formatted}`;
}

export function formatAsOfDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

export function datasetQueryKey(ref: DatasetRef, asOf?: string | null): string {
  const base = serializeDatasetParam(ref);
  if (!asOf || ref.kind !== "current") return base;
  return `${base}?asOf=${asOf}`;
}

export function tryParseAsOfParam(
  raw: string | null | undefined
): { success: true; data: string | null } | { success: false; error: z.ZodError } {
  if (raw == null || raw === "") {
    return { success: true, data: null };
  }
  const result = asOfParamSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data ?? null };
}
