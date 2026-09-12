ALTER TABLE clan_data RENAME TO clan_data_legacy_json;
ALTER TABLE members RENAME TO members_legacy_json;
ALTER TABLE events RENAME TO events_legacy_json;

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (btrim(full_name) <> ''),
  familiar_name TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  birth_year SMALLINT CHECK (birth_year BETWEEN 1 AND 9999),
  birth_date DATE,
  life_status TEXT CHECK (life_status IN ('living', 'deceased')),
  death_date DATE,
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

CREATE TEMP TABLE member_migration_map ON COMMIT DROP AS
SELECT id AS legacy_id, gen_random_uuid() AS member_id, data
FROM members_legacy_json;

INSERT INTO members (
  id, full_name, familiar_name, gender, birth_year, birth_date,
  life_status, death_date, death_anniversary_lunar_day,
  death_anniversary_lunar_month, hometown, residence, biography
)
SELECT
  member_id,
  data->>'fullName',
  NULLIF(data->>'familiarName', ''),
  data->>'gender',
  NULLIF(data->>'birthYear', '')::smallint,
  NULLIF(data->>'birthDate', '')::date,
  NULLIF(data->>'status', ''),
  NULLIF(data->>'deathDate', '')::date,
  NULLIF(data->'deathAnniversaryLunar'->>'day', '')::smallint,
  NULLIF(data->'deathAnniversaryLunar'->>'month', '')::smallint,
  NULLIF(data->>'hometown', ''),
  NULLIF(data->>'residence', ''),
  NULLIF(data->>'biography', '')
FROM member_migration_map;

INSERT INTO member_parents (child_id, parent_id, parent_order)
SELECT child.member_id, parent.member_id, relation.parent_order::smallint
FROM member_migration_map AS child
CROSS JOIN LATERAL jsonb_array_elements_text(
  COALESCE(child.data->'parentIds', '[]'::jsonb)
) WITH ORDINALITY AS relation(parent_legacy_id, parent_order)
JOIN member_migration_map AS parent
  ON parent.legacy_id = relation.parent_legacy_id;

INSERT INTO member_spouses (member_a_id, member_b_id)
SELECT DISTINCT
  LEAST(member.member_id, spouse.member_id),
  GREATEST(member.member_id, spouse.member_id)
FROM member_migration_map AS member
CROSS JOIN LATERAL jsonb_array_elements_text(
  COALESCE(member.data->'spouseIds', '[]'::jsonb)
) AS relation(spouse_legacy_id)
JOIN member_migration_map AS spouse
  ON spouse.legacy_id = relation.spouse_legacy_id
WHERE member.member_id <> spouse.member_id;

CREATE TEMP TABLE event_migration_map ON COMMIT DROP AS
SELECT id AS legacy_id, gen_random_uuid() AS event_id, data
FROM events_legacy_json;

INSERT INTO events (
  id, title, type, calendar, day, month, recurrence, event_year,
  location, description
)
SELECT
  event_id,
  data->>'title',
  data->>'type',
  data->>'calendar',
  (data->>'day')::smallint,
  (data->>'month')::smallint,
  data->>'recurrence',
  NULLIF(data->>'year', '')::smallint,
  COALESCE(data->>'location', ''),
  NULLIF(data->>'description', '')
FROM event_migration_map;

INSERT INTO event_members (event_id, member_id)
SELECT event.event_id, member.member_id
FROM event_migration_map AS event
CROSS JOIN LATERAL jsonb_array_elements_text(
  COALESCE(event.data->'relatedMemberIds', '[]'::jsonb)
) AS relation(member_legacy_id)
JOIN member_migration_map AS member
  ON member.legacy_id = relation.member_legacy_id;

INSERT INTO event_solar_dates (event_id, year, solar_date)
SELECT event.event_id, solar.year_text::smallint, solar.date_text::date
FROM event_migration_map AS event
CROSS JOIN LATERAL jsonb_each_text(
  COALESCE(event.data->'solarDates', '{}'::jsonb)
) AS solar(year_text, date_text);

COMMENT ON TABLE members IS
  'People use generated UUID identifiers, and generation is derived from relationships.';
COMMENT ON TABLE member_parents IS
  'Directed parent-child relationships used to derive family generations.';
COMMENT ON TABLE member_spouses IS
  'Undirected spouse relationships stored once in canonical UUID order.';
