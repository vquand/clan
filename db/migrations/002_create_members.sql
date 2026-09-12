CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT members_data_object CHECK (jsonb_typeof(data) = 'object')
);
