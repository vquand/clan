CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (btrim(full_name) <> ''),
  familiar_name TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  clan_relation TEXT NOT NULL CHECK (clan_relation IN ('lineage', 'marriage')),
  birth_year SMALLINT CHECK (birth_year BETWEEN 1 AND 9999),
  birth_date DATE,
  life_status TEXT CHECK (life_status IN ('living', 'deceased')),
  death_year SMALLINT CHECK (death_year BETWEEN 1 AND 9999),
  death_date DATE,
  age_at_death SMALLINT CHECK (age_at_death BETWEEN 0 AND 150),
  age_at_death_qualifier TEXT CHECK (
    age_at_death_qualifier IN ('exact', 'approximately', 'under')
  ),
  age_group TEXT CHECK (age_group IN ('senior')),
  avatar_style TEXT NOT NULL CHECK (
    avatar_style IN ('default', 'style-1', 'style-2', 'style-3')
  ),
  avatar_image_url TEXT CHECK (
    avatar_image_url IS NULL OR btrim(avatar_image_url) <> ''
  ),
  is_clan_head BOOLEAN NOT NULL DEFAULT FALSE,
  is_previous_clan_head BOOLEAN NOT NULL DEFAULT FALSE,
  death_anniversary_lunar_day SMALLINT CHECK (
    death_anniversary_lunar_day BETWEEN 1 AND 30
  ),
  death_anniversary_lunar_month SMALLINT CHECK (
    death_anniversary_lunar_month BETWEEN 1 AND 12
  ),
  hometown TEXT,
  residence TEXT,
  biography TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT members_lunar_anniversary_complete CHECK (
    (death_anniversary_lunar_day IS NULL) =
    (death_anniversary_lunar_month IS NULL)
  ),
  CONSTRAINT members_age_at_death_qualifier_pair CHECK (
    (age_at_death IS NULL) = (age_at_death_qualifier IS NULL)
  ),
  CONSTRAINT members_avatar_image_data_size CHECK (
    avatar_image_url IS NULL OR
    avatar_image_url NOT LIKE 'data:image/%' OR
    octet_length(avatar_image_url) <= 24000
  ),
  CONSTRAINT members_clan_head_not_deceased CHECK (
    NOT is_clan_head OR life_status IS DISTINCT FROM 'deceased'
  ),
  CONSTRAINT members_clan_head_flags_exclusive CHECK (
    NOT (is_clan_head AND is_previous_clan_head)
  )
);

CREATE TABLE member_parents (
  child_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  parent_order SMALLINT NOT NULL CHECK (parent_order > 0),
  PRIMARY KEY (child_id, parent_id),
  UNIQUE (child_id, parent_order),
  CHECK (child_id <> parent_id)
);

CREATE TABLE member_spouses (
  member_a_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_b_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_a_id, member_b_id),
  CHECK (member_a_id < member_b_id)
);

CREATE TABLE clan_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  address TEXT NOT NULL DEFAULT '',
  google_map_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  type TEXT NOT NULL CHECK (
    type IN ('death-anniversary', 'clan-ceremony', 'gathering')
  ),
  calendar TEXT NOT NULL CHECK (calendar IN ('solar', 'lunar')),
  day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 31),
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  recurrence TEXT NOT NULL CHECK (recurrence IN ('annual', 'once')),
  event_year SMALLINT CHECK (event_year BETWEEN 1 AND 9999),
  location TEXT NOT NULL DEFAULT '',
  location_id UUID REFERENCES clan_locations(id) ON DELETE SET NULL,
  location_address TEXT NOT NULL DEFAULT '',
  location_google_map_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_once_has_year CHECK (
    recurrence = 'annual' OR event_year IS NOT NULL
  )
);

CREATE TABLE event_members (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

CREATE TABLE event_solar_dates (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL CHECK (year BETWEEN 1 AND 9999),
  solar_date DATE NOT NULL,
  PRIMARY KEY (event_id, year)
);

CREATE INDEX member_parents_parent_id_idx ON member_parents(parent_id);
CREATE INDEX member_spouses_member_b_id_idx ON member_spouses(member_b_id);
CREATE INDEX event_members_member_id_idx ON event_members(member_id);
CREATE INDEX events_location_id_idx ON events(location_id);

CREATE UNIQUE INDEX members_one_current_clan_head_idx
ON members (is_clan_head)
WHERE is_clan_head;

COMMENT ON TABLE members IS
  'People use generated UUID identifiers, and generation is derived from relationships.';
COMMENT ON TABLE member_parents IS
  'Directed parent-child relationships used to derive family generations.';
COMMENT ON TABLE member_spouses IS
  'Undirected spouse relationships stored once in canonical UUID order.';
COMMENT ON COLUMN members.clan_relation IS
  'Internal lineage or marriage relationship metadata; not displayed as a label in the user interface.';
COMMENT ON COLUMN members.avatar_style IS
  'Optional people-icon hairstyle selection; default keeps the standard icon.';
COMMENT ON COLUMN members.avatar_image_url IS
  'Optional uploaded or hosted portrait URL; when present it replaces the generated icon.';
COMMENT ON CONSTRAINT members_avatar_image_data_size ON members IS
  'Compressed custom avatar data URLs are limited to 24 KB.';
COMMENT ON COLUMN members.death_year IS
  'Year of death when the exact death date is not known.';
COMMENT ON COLUMN members.age_at_death IS
  'Recorded age at death when birth or death dates are incomplete.';
COMMENT ON COLUMN members.age_at_death_qualifier IS
  'Whether the recorded age is exact, approximate, or an upper bound.';
COMMENT ON COLUMN members.is_clan_head IS
  'Whether this living member is the current head of the clan.';
COMMENT ON COLUMN members.is_previous_clan_head IS
  'Whether this member previously served as head of the clan.';
COMMENT ON TABLE clan_locations IS
  'Important clan locations available for reuse when creating events.';
COMMENT ON COLUMN events.location_id IS
  'Optional saved clan location selected for this event.';
COMMENT ON COLUMN events.location_address IS
  'Address snapshot for event locations, including legacy or custom locations.';
COMMENT ON COLUMN events.location_google_map_url IS
  'Optional Google Maps shared URL for the event location.';
