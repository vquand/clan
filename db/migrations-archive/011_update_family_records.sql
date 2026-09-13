ALTER TABLE members
ADD COLUMN death_year SMALLINT CHECK (death_year BETWEEN 1 AND 9999),
ADD COLUMN age_at_death SMALLINT CHECK (age_at_death BETWEEN 0 AND 150),
ADD COLUMN age_at_death_qualifier TEXT CHECK (
  age_at_death_qualifier IN ('exact', 'approximately', 'under')
),
ADD CONSTRAINT members_age_at_death_qualifier_pair CHECK (
  (age_at_death IS NULL) = (age_at_death_qualifier IS NULL)
);

COMMENT ON COLUMN members.death_year IS
  'Year of death when the exact death date is not known.';

COMMENT ON COLUMN members.age_at_death IS
  'Recorded age at death when birth or death dates are incomplete.';

COMMENT ON COLUMN members.age_at_death_qualifier IS
  'Whether the recorded age is exact, approximate, or an upper bound.';

UPDATE members
SET birth_year = 1985,
    birth_date = DATE '1985-08-27',
    life_status = 'living'
WHERE full_name = 'Trương Hồng Vân';

UPDATE members
SET birth_year = 2021,
    birth_date = DATE '2021-08-24',
    life_status = 'living'
WHERE full_name IN ('Đỗ Bảo Hân', 'Bảo Hân');

UPDATE members
SET full_name = 'Đỗ Mạnh Toàn Thắng'
WHERE full_name = 'Đỗ Thắng';

UPDATE members
SET birth_year = 1926,
    life_status = 'deceased',
    death_year = 1986,
    death_date = NULL,
    age_at_death = 60,
    age_at_death_qualifier = 'approximately'
WHERE full_name = 'Nguyễn Thị Rụt';

INSERT INTO members (
  full_name, gender, clan_relation, birth_year, life_status,
  age_at_death, age_at_death_qualifier, avatar_style
)
SELECT
  source.full_name,
  source.gender,
  'lineage',
  source.birth_year,
  'deceased',
  source.age_at_death,
  source.age_at_death_qualifier,
  'default'
FROM (
  VALUES
    ('Đỗ Văn Quất', 'male', 1921, 87, 'exact'),
    ('Đỗ Thị Đếm', 'female', NULL, 18, 'approximately'),
    ('Đỗ Văn Trung', 'male', NULL, 3, 'under'),
    ('Đỗ Thị Tiêu', 'female', NULL, 10, 'under')
) AS source(
  full_name, gender, birth_year, age_at_death, age_at_death_qualifier
)
WHERE NOT EXISTS (
  SELECT 1
  FROM members AS existing
  WHERE existing.full_name = source.full_name
);

WITH requested_parents(child_name, parent_name, parent_order) AS (
  VALUES
    ('Đỗ Văn Quất', 'Đỗ Văn Côi', 1),
    ('Đỗ Văn Quất', 'Dương Thị Rường', 2),
    ('Đỗ Thị Đếm', 'Đỗ Văn Côi', 1),
    ('Đỗ Thị Đếm', 'Dương Thị Rường', 2),
    ('Đỗ Văn Trung', 'Đỗ Văn Tiền', 1),
    ('Đỗ Văn Trung', 'Nguyễn Thị Rụt', 2),
    ('Đỗ Thị Tiêu', 'Đỗ Văn Tiền', 1),
    ('Đỗ Thị Tiêu', 'Nguyễn Thị Rụt', 2)
)
INSERT INTO member_parents (child_id, parent_id, parent_order)
SELECT child.id, parent.id, requested.parent_order
FROM requested_parents AS requested
JOIN members AS child ON child.full_name = requested.child_name
JOIN members AS parent ON parent.full_name = requested.parent_name
ON CONFLICT (child_id, parent_id) DO NOTHING;
