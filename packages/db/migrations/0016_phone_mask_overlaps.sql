CREATE OR REPLACE FUNCTION phone_mask_overlaps(
  p_start bigint,
  p_end bigint,
  p_mask varchar(10)
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  first bigint;
  last bigint;
  i int;
  slot text;
  digit int;
  pow bigint;
  block_step bigint;
  offset_val bigint;
  div bigint;
  rem bigint;
BEGIN
  IF length(p_mask) < 10 THEN
    p_mask := rpad(p_mask, 10, '_');
  END IF;

  IF p_start > p_end THEN
    RETURN false;
  END IF;

  first := p_start;
  last := p_end;

  FOR i IN 0..6 LOOP
    slot := substr(p_mask, i + 4, 1);
    IF slot <> '_' THEN
      digit := slot::int;
      pow := power(10, 6 - i)::bigint;
      block_step := 10 * pow;
      offset_val := digit * pow;

      IF i = 0 THEN
        first := GREATEST(first, offset_val);
        last := LEAST(last, offset_val + pow - 1);
      ELSE
        div := first / block_step;
        rem := first - div * block_step;
        IF rem >= offset_val AND rem < offset_val + pow THEN
          NULL;
        ELSIF rem < offset_val THEN
          first := div * block_step + offset_val;
        ELSE
          first := (div + 1) * block_step + offset_val;
        END IF;

        div := last / block_step;
        rem := last - div * block_step;
        IF rem >= offset_val AND rem < offset_val + pow THEN
          NULL;
        ELSIF rem < offset_val THEN
          last := LEAST(last, (div - 1) * block_step + offset_val + pow - 1);
        ELSE
          last := div * block_step + offset_val + pow - 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN first <= last;
END;
$$;
