CREATE TABLE clan_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  address TEXT NOT NULL DEFAULT '',
  google_map_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events
ADD COLUMN location_id UUID REFERENCES clan_locations(id) ON DELETE SET NULL,
ADD COLUMN location_address TEXT NOT NULL DEFAULT '',
ADD COLUMN location_google_map_url TEXT;

CREATE INDEX events_location_id_idx ON events(location_id);

INSERT INTO clan_locations (name)
SELECT DISTINCT btrim(location)
FROM events
WHERE btrim(location) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE events
SET location_id = clan_locations.id
FROM clan_locations
WHERE events.location_id IS NULL
  AND btrim(events.location) = clan_locations.name;

COMMENT ON TABLE clan_locations IS
  'Important clan locations available for reuse when creating events.';

COMMENT ON COLUMN events.location_id IS
  'Optional saved clan location selected for this event.';

COMMENT ON COLUMN events.location_address IS
  'Address snapshot for event locations, including legacy or custom locations.';

COMMENT ON COLUMN events.location_google_map_url IS
  'Optional Google Maps shared URL for the event location.';
