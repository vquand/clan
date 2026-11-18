CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL,
  full_name TEXT NOT NULL CHECK (trim(full_name) <> ''),
  familiar_name TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  clan_relation TEXT NOT NULL CHECK (clan_relation IN ('lineage', 'marriage')),
  sibling_order INTEGER CHECK (sibling_order > 0),
  birth_year INTEGER CHECK (birth_year BETWEEN 1 AND 9999),
  birth_date TEXT,
  life_status TEXT CHECK (life_status IN ('living', 'deceased', 'unknown')),
  death_year INTEGER CHECK (death_year BETWEEN 1 AND 9999),
  death_date TEXT,
  age_at_death INTEGER CHECK (age_at_death BETWEEN 0 AND 150),
  age_at_death_qualifier TEXT CHECK (
    age_at_death_qualifier IN ('exact', 'approximately', 'under')
  ),
  age_group TEXT CHECK (age_group IN ('senior')),
  avatar_style TEXT NOT NULL CHECK (
    avatar_style IN ('default', 'style-1', 'style-2', 'style-3')
  ),
  avatar_image_url TEXT CHECK (
    avatar_image_url IS NULL OR trim(avatar_image_url) <> ''
  ),
  is_clan_head INTEGER NOT NULL DEFAULT 0 CHECK (is_clan_head IN (0, 1)),
  is_previous_clan_head INTEGER NOT NULL DEFAULT 0 CHECK (is_previous_clan_head IN (0, 1)),
  death_anniversary_lunar_day INTEGER CHECK (
    death_anniversary_lunar_day BETWEEN 1 AND 30
  ),
  death_anniversary_lunar_month INTEGER CHECK (
    death_anniversary_lunar_month BETWEEN 1 AND 12
  ),
  hometown TEXT,
  residence TEXT,
  biography TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    length(CAST(avatar_image_url AS BLOB)) <= 24000
  ),
  CONSTRAINT members_clan_head_not_deceased CHECK (
    NOT is_clan_head OR life_status IS DISTINCT FROM 'deceased'
  ),
  CONSTRAINT members_clan_head_flags_exclusive CHECK (
    NOT (is_clan_head AND is_previous_clan_head)
  )
);

CREATE TABLE member_parents (
  child_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  parent_order INTEGER NOT NULL CHECK (parent_order > 0),
  PRIMARY KEY (child_id, parent_id),
  UNIQUE (child_id, parent_order),
  CHECK (child_id <> parent_id)
);

CREATE TABLE member_spouses (
  member_a_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_b_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_a_id, member_b_id),
  CHECK (member_a_id < member_b_id)
);

CREATE TABLE clan_locations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE CHECK (trim(name) <> ''),
  address TEXT NOT NULL DEFAULT '',
  google_map_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (trim(title) <> ''),
  type TEXT NOT NULL CHECK (
    type IN ('death-anniversary', 'clan-ceremony', 'gathering')
  ),
  calendar TEXT NOT NULL CHECK (calendar IN ('solar', 'lunar')),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  recurrence TEXT NOT NULL CHECK (recurrence IN ('annual', 'once')),
  event_year INTEGER CHECK (event_year BETWEEN 1 AND 9999),
  location TEXT NOT NULL DEFAULT '',
  location_id TEXT REFERENCES clan_locations(id) ON DELETE SET NULL,
  location_address TEXT NOT NULL DEFAULT '',
  location_google_map_url TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT events_once_has_year CHECK (
    recurrence = 'annual' OR event_year IS NOT NULL
  )
);

CREATE TABLE event_members (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

CREATE TABLE event_solar_dates (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 9999),
  solar_date TEXT NOT NULL,
  PRIMARY KEY (event_id, year)
);

CREATE INDEX member_parents_parent_id_idx ON member_parents(parent_id);
CREATE INDEX member_spouses_member_b_id_idx ON member_spouses(member_b_id);
CREATE INDEX event_members_member_id_idx ON event_members(member_id);
CREATE INDEX events_location_id_idx ON events(location_id);

CREATE UNIQUE INDEX members_one_current_clan_head_idx
ON members (is_clan_head)
WHERE is_clan_head;

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX login_attempts_expiry_idx ON login_attempts(expires_at);
