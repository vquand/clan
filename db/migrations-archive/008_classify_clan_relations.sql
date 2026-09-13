UPDATE members
SET clan_relation = CASE
  WHEN full_name LIKE '%Đỗ%' THEN 'lineage'
  ELSE 'marriage'
END
WHERE clan_relation IS DISTINCT FROM CASE
  WHEN full_name LIKE '%Đỗ%' THEN 'lineage'
  ELSE 'marriage'
END;

COMMENT ON COLUMN members.clan_relation IS
  'Internal lineage or marriage relationship metadata; names containing Đỗ are clan lineage and other names are joined by marriage. Not displayed as a label in the user interface.';
