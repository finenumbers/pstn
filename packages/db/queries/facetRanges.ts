import type {
  DictFacetColumn,
  FiltersDTO,
  FacetColumn,
} from "@/packages/shared/contracts/filters.schema";
import { facetInnRanges } from "./facetInnRanges";
import { facetRangesFromDict } from "./facetRangesFromDict";
import { facetUvrAntifraudRanges } from "./facetUvrAntifraudRanges";

export async function facetRanges(params: {
  column: FacetColumn;
  filters: FiltersDTO;
  search?: string;
  limit?: number;
}) {
  switch (params.column) {
    case "inn":
      return facetInnRanges(params);
    case "uvrAntifraud":
      return facetUvrAntifraudRanges(params);
    default:
      return facetRangesFromDict({
        ...params,
        column: params.column as DictFacetColumn,
      });
  }
}
