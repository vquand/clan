ALTER TABLE members
ADD COLUMN clan_relation TEXT NOT NULL DEFAULT 'lineage'
CHECK (clan_relation IN ('lineage', 'marriage'));

ALTER TABLE members ALTER COLUMN clan_relation DROP DEFAULT;

COMMENT ON COLUMN members.clan_relation IS
  'Explicit lineage or marriage relationship to the clan; never inferred from surname or tree position.';
