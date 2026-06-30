import {
  DIFF_CHANGE_STATUS_KEYS,
  DIFF_CHANGE_STATUS_LABELS,
  type DiffChangeStatusKey,
} from "@/lib/diff/diffChangedFields";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { and, count, type SQL } from "drizzle-orm";
import { db } from "../index";
import { buildWhere } from "./buildWhere";
import { sqlForChangeStatusKey } from "./changeStatusFilter";
import { resolveQueryContext } from "./datasetContext";

function matchesSearch(key: DiffChangeStatusKey, search?: string): boolean {
  if (!search?.trim()) return true;
  const label = DIFF_CHANGE_STATUS_LABELS[key];
  return label.toLowerCase().includes(search.trim().toLowerCase());
}

export async function facetChangeStatusRanges(params: {
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
  const baseWhere = buildWhere(params.filters, context, "changeStatus");

  const keys = DIFF_CHANGE_STATUS_KEYS.filter((key) =>
    matchesSearch(key, params.search)
  );

  const options = await Promise.all(
    keys.map(async (key) => {
      const statusWhere = sqlForChangeStatusKey(key);
      const where: SQL | undefined = baseWhere
        ? and(baseWhere, statusWhere)
        : statusWhere;

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

  const present = options.filter((option) => option.count > 0);
  present.sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value)
  );

  return {
    options: present,
    totalDistinct: present.length,
  };
}
