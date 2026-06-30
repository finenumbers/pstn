import { describe, expect, it } from "vitest";
import {
  sqlForChangeStatusKey,
  sqlForChangeStatusKeys,
} from "@/packages/db/queries/changeStatusFilter";

describe("changeStatusFilter", () => {
  it("builds SQL for each valid filter key", () => {
    for (const key of ["added", "changed", "removed"] as const) {
      expect(sqlForChangeStatusKey(key)).toBeDefined();
    }
  });

  it("returns undefined for empty or invalid keys", () => {
    expect(sqlForChangeStatusKeys([])).toBeUndefined();
    expect(sqlForChangeStatusKeys(["unknown"])).toBeUndefined();
  });

  it("combines multiple keys with OR", () => {
    const single = sqlForChangeStatusKeys(["added"]);
    const multi = sqlForChangeStatusKeys(["added", "removed"]);
    expect(single).toBeDefined();
    expect(multi).toBeDefined();
    expect(multi).not.toEqual(single);
  });
});
