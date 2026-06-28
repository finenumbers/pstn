import { z } from "zod";

export const DATASET_CURRENT_ID = "current";

const diffDatasetParamSchema = z
  .string()
  .refine((value) => value.startsWith("diff:"), "Diff dataset must use diff: prefix")
  .transform((value) => value.slice("diff:".length))
  .pipe(z.string().uuid("Invalid snapshot id"));

export const datasetParamSchema = z
  .string()
  .optional()
  .transform((value) => value ?? DATASET_CURRENT_ID)
  .pipe(
    z.union([
      z.literal(DATASET_CURRENT_ID),
      diffDatasetParamSchema.transform((snapshotId) => `diff:${snapshotId}`),
    ])
  );

export type DatasetKind = "current" | "diff";

export interface DatasetRef {
  kind: DatasetKind;
  snapshotId?: string;
}

export interface DatasetListItem {
  id: string;
  kind: DatasetKind;
  label: string;
  loadDate: string;
  stats?: {
    added: number;
    changed: number;
    removed: number;
  };
}

export interface DatasetsResponse {
  items: DatasetListItem[];
}

export function parseDatasetParam(raw: string | null | undefined): DatasetRef {
  const parsed = datasetParamSchema.parse(raw ?? DATASET_CURRENT_ID);
  if (parsed === DATASET_CURRENT_ID) {
    return { kind: "current" };
  }
  return { kind: "diff", snapshotId: parsed.slice("diff:".length) };
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
  return {
    success: true,
    data: { kind: "diff", snapshotId: result.data.slice("diff:".length) },
  };
}

export function serializeDatasetParam(ref: DatasetRef): string {
  if (ref.kind === "current") return DATASET_CURRENT_ID;
  return `diff:${ref.snapshotId}`;
}

export function formatDatasetLabel(kind: DatasetKind, loadDate: string): string {
  const [year, month, day] = loadDate.split("-");
  const formatted = `${day}.${month}.${year}`;
  return kind === "current"
    ? `Датасет ${formatted}`
    : `Расхождения ${formatted}`;
}

export function datasetQueryKey(ref: DatasetRef): string {
  return serializeDatasetParam(ref);
}
