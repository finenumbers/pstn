ALTER TABLE "number_ranges"
  ADD COLUMN IF NOT EXISTS "abc_gap_before" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "abc_gap_after" boolean NOT NULL DEFAULT false;

UPDATE number_ranges nr
SET
  abc_gap_before = gaps.gap_before,
  abc_gap_after = gaps.gap_after
FROM (
  SELECT
    id,
    COALESCE(prev_range_end + 1 < range_start, false) AS gap_before,
    COALESCE(range_end + 1 < next_range_start, false) AS gap_after
  FROM (
    SELECT
      id,
      range_start,
      range_end,
      LAG(range_end) OVER (PARTITION BY abc ORDER BY range_start) AS prev_range_end,
      LEAD(range_start) OVER (PARTITION BY abc ORDER BY range_start) AS next_range_start
    FROM number_ranges
  ) ordered
) gaps
WHERE nr.id = gaps.id;
