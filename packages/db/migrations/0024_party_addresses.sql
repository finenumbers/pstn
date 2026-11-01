CREATE TABLE IF NOT EXISTS party_addresses (
  inn varchar(12) PRIMARY KEY,
  legal_address text,
  status varchar(16) NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_addresses_status_check
    CHECK (status IN ('ok', 'not_found', 'no_address'))
);

ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS enrich_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_done integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_with_address integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_empty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_stop_reason text;
