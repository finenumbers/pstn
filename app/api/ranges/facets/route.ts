import { NextRequest, NextResponse } from "next/server";
import {
  FACET_COLUMNS,
  FILTER_LIMITS,
  filtersSchema,
  parseFiltersFromSearchParams,
  type FacetColumn,
  type FiltersDTO,
} from "@/packages/shared/contracts/filters.schema";
import { facetRanges } from "@/packages/db/queries/facetRanges";
import {
  isDatasetAndAsOfParseError,
  parseDatasetAndAsOf,
} from "@/lib/api/datasetAndAsOf";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
import { countFacetValue } from "@/packages/db/queries/countFacetValue";
import { phoneFilterTimingMeta } from "@/lib/phone/phoneFilterMeta";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
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
      return apiError(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Не указаны допустимые колонки для фильтра.",
        400
      );
    }

    const filtersRaw = parseFiltersFromSearchParams(params);
    const filtersParsed = filtersSchema.safeParse(filtersRaw);
    if (!filtersParsed.success) {
      return validationError(filtersParsed.error);
    }
    const filters = filtersParsed.data;
    const parsedDataset = parseDatasetAndAsOf(params);
    if (isDatasetAndAsOfParseError(parsedDataset)) {
      return parsedDataset;
    }
    const { dataset, asOf } = parsedDataset;

    const search: Record<string, string> = {};
    for (const col of columns) {
      const val = params.get(`search.${col}`);
      if (!val) continue;
      if (val.length > FILTER_LIMITS.maxTextFilterLength) {
        return apiError(
          API_ERROR_CODES.VALIDATION_ERROR,
          "Слишком длинный текст поиска в фильтре.",
          400
        );
      }
      search[col] = val;
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
          dataset,
          asOf,
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
            count: await countFacetValue(column, selected, filters, dataset, asOf),
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
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error);
  }
}
