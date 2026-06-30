import { numberRangeDiffs, numberRangeFullSnapshots, numberRanges } from "../schema";

export type RangeFilterTable =
  | typeof numberRanges
  | typeof numberRangeDiffs
  | typeof numberRangeFullSnapshots;
