import {
  DIFF_CHANGED_FIELD_KEYS,
  DIFF_CHANGED_FIELD_LABELS,
  type DiffChangedFieldKey,
} from "@/lib/diff/diffChangedFields";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { and, count, type SQL } from "drizzle-orm";
import { db } from "../index";
import { buildWhere } from "./buildWhere";
import { sqlForChangedFieldKey } from "./changedFieldsFilter";
import { resolveQueryContext } from "./datasetContext";

function matchesSearch(key: DiffChangedFieldKey, search?: string): boolean {
  if (!search?.trim()) return true;
  const label = DIFF_CHANGED_FIELD_LABELS[key];
  return label.toLowerCase().includes(search.trim().toLowerCase());
}

export async function facetChangedFieldsRanges(params: {
  filters: FiltersDTO;
  search?: string;
  dataset?: DatasetRef;
  asOf?: string | null;
}) {
  const context = await resolveQueryContext(params.dataset, params.asOf);
  if (!context.isDiff) {
    return { options: [], totalDistinct: 0 };
  }

  const table = context.table;
  const baseWhere = buildWhere(params.filters, context, "changedFields");

  const keys = DIFF_CHANGED_FIELD_KEYS.filter((key) =>
    matchesSearch(key, params.search)
  );

  const options = await Promise.all(
    keys.map(async (key) => {
      const fieldWhere = sqlForChangedFieldKey(key);
      const where: SQL | undefined = baseWhere
        ? and(baseWhere, fieldWhere)
        : fieldWhere;

      const result = await db
        .select({ count: count() })
        .from(table)
        .where(where);

      return {
        value: key,
        count: Number(result[0]?.count ?? 0),
      };
    })
  );

  options.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return {
    options,
    totalDistinct: keys.length,
  };
}
