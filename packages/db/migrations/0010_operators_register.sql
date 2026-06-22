CREATE TABLE IF NOT EXISTS operators_register (
  id_src integer PRIMARY KEY,
  opr_name text NOT NULL,
  opr_nick text NOT NULL,
  inn varchar(12) NOT NULL UNIQUE,
  bdpn_code text NOT NULL DEFAULT '',
  name_brand text NOT NULL DEFAULT '',
  source_file text NOT NULL DEFAULT '',
  loaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operators_register_opr_nick
  ON operators_register (opr_nick);

CREATE INDEX IF NOT EXISTS idx_operators_register_opr_name_trgm
  ON operators_register USING gin (opr_name gin_trgm_ops);
