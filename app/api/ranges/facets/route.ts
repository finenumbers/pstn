import { NextRequest, NextResponse } from "next/server";
import {
  FACET_COLUMNS,
  filtersSchema,
  parseFiltersFromSearchParams,
  type FacetColumn,
  type FiltersDTO,
} from "@/packages/shared/contracts/filters.schema";
import { facetRanges } from "@/packages/db/queries/facetRanges";
import { countFacetValue } from "@/packages/db/queries/countFacetValue";
import { phoneFilterTimingMeta } from "@/lib/phone/phoneFilterMeta";
import { apiError, internalServerError, validationError, withTiming } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  try {
    const params = request.nextUrl.searchParams;
    const columnsParam = params.get("columns") ?? FACET_COLUMNS.join(",");
    const columns = columnsParam
      .split(",")
      .filter((c): c is FacetColumn =>
        FACET_COLUMNS.includes(c as FacetColumn)
      );

    if (columns.length === 0) {
      return apiError("VALIDATION_ERROR", "No valid facet columns", 400);
    }

    const filtersRaw = parseFiltersFromSearchParams(params);
    const filtersParsed = filtersSchema.safeParse(filtersRaw);
    if (!filtersParsed.success) {
      return validationError(filtersParsed.error);
    }
    const filters = filtersParsed.data;

    const search: Record<string, string> = {};
    for (const col of columns) {
      const val = params.get(`search.${col}`);
      if (val) search[col] = val;
    }

    const facets: Record<
      string,
      {
        options: Array<{
          value: string;
          count: number;
          selected: boolean;
          disabled?: boolean;
        }>;
        totalDistinct: number;
      }
    > = {};

    const facetResults = await Promise.all(
      columns.map((column) =>
        facetRanges({
          column,
          filters,
          search: search[column],
          limit: 200,
        })
      )
    );

    for (let index = 0; index < columns.length; index++) {
      const column = columns[index];
      const result = facetResults[index];
      const selectedValues = filters[column as keyof FiltersDTO] as string[];

      const optionMap = new Map(
        result.options.map((o) => [o.value, o])
      );

      const missingSelected = selectedValues.filter((s) => !optionMap.has(s));
      if (missingSelected.length > 0) {
        const counts = await Promise.all(
          missingSelected.map(async (selected) => ({
            selected,
            count: await countFacetValue(column, selected, filters),
          }))
        );
        for (const { selected, count } of counts) {
          optionMap.set(selected, { value: selected, count });
        }
      }

      facets[column] = {
        options: Array.from(optionMap.values()).map((o) => ({
          value: o.value,
          count: o.count,
          selected: selectedValues.includes(o.value),
          disabled: o.count === 0,
        })),
        totalDistinct: result.totalDistinct,
      };
    }

    withTiming("/api/ranges/facets", startMs, {
      columns,
      ...phoneFilterTimingMeta(filters),
    });

    return NextResponse.json({ facets });
  } catch (error) {
    return internalServerError(error);
  }
}
