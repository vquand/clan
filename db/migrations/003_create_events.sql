CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_data_object CHECK (jsonb_typeof(data) = 'object')
);
