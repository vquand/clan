CREATE TABLE IF NOT EXISTS clan_data (
  id TEXT PRIMARY KEY,
  members JSONB NOT NULL,
  events JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clan_data_members_array CHECK (jsonb_typeof(members) = 'array'),
  CONSTRAINT clan_data_events_array CHECK (jsonb_typeof(events) = 'array')
);
