ALTER TABLE members
ADD COLUMN clan_relation TEXT NOT NULL DEFAULT 'lineage'
CHECK (clan_relation IN ('lineage', 'marriage'));

ALTER TABLE members ALTER COLUMN clan_relation DROP DEFAULT;

COMMENT ON COLUMN members.clan_relation IS
  'Internal lineage or marriage relationship metadata; not displayed as a label in the user interface.';
