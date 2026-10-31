import { describe, expect, it } from "vitest";
import {
  sqlForChangedFieldKey,
  sqlForChangedFieldKeys,
} from "@/packages/db/queries/changedFieldsFilter";

describe("changedFieldsFilter", () => {
  it("builds SQL for each valid filter key", () => {
    for (const key of ["operator", "garTerritory", "inn"] as const) {
      expect(sqlForChangedFieldKey(key)).toBeDefined();
    }
  });

  it("returns undefined for empty or invalid keys", () => {
    expect(sqlForChangedFieldKeys([])).toBeUndefined();
    expect(sqlForChangedFieldKeys(["unknown", "added", "removed"])).toBeUndefined();
  });

  it("combines multiple keys with OR", () => {
    const single = sqlForChangedFieldKeys(["operator"]);
    const multi = sqlForChangedFieldKeys(["operator", "inn"]);
    expect(single).toBeDefined();
    expect(multi).toBeDefined();
    expect(multi).not.toEqual(single);
  });
});
