ALTER TABLE members
ADD COLUMN is_clan_head BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN is_previous_clan_head BOOLEAN NOT NULL DEFAULT FALSE,
ADD CONSTRAINT members_clan_head_not_deceased CHECK (
  NOT is_clan_head OR life_status IS DISTINCT FROM 'deceased'
),
ADD CONSTRAINT members_clan_head_flags_exclusive CHECK (
  NOT (is_clan_head AND is_previous_clan_head)
);

CREATE UNIQUE INDEX members_one_current_clan_head_idx
ON members (is_clan_head)
WHERE is_clan_head;

COMMENT ON COLUMN members.is_clan_head IS
  'Whether this living member is the current head of the clan.';

COMMENT ON COLUMN members.is_previous_clan_head IS
  'Whether this member previously served as head of the clan.';
