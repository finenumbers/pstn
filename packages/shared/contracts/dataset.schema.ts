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

/** Earliest full snapshot date (baseline / first import). */
export function getFirstDatasetLoadDate(
  items: readonly Pick<DatasetChangeDateItem, "loadDate">[]
): string | null {
  if (items.length === 0) return null;
  let min = items[0]!.loadDate;
  for (const item of items) {
    if (item.loadDate < min) min = item.loadDate;
  }
  return min;
}

export function isSelectableAsOfDate(
  isoDate: string,
  firstLoadDate: string | null
): boolean {
  if (!firstLoadDate) return false;
  return isoDate >= firstLoadDate;
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

/** Format typed digits as DD.MM.YYYY (auto-insert dots, max 8 digits). */
export function maskAsOfDisplayDateInput(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** Parse DD.MM.YYYY (or D.M.YYYY) to ISO YYYY-MM-DD; null if invalid, future, or before first load. */
export function parseAsOfDisplayDate(
  input: string,
  options?: { firstLoadDate?: string | null }
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let day: number;
  let month: number;
  let year: number;

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    day = Number(dotted[1]);
    month = Number(dotted[2]);
    year = Number(dotted[3]);
  } else {
    const normalized = maskAsOfDisplayDateInput(trimmed);
    const match = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  if (parsed > new Date()) return null;

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (
    options?.firstLoadDate &&
    !isSelectableAsOfDate(iso, options.firstLoadDate)
  ) {
    return null;
  }

  return iso;
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
