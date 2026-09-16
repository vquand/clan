ALTER TABLE members
DROP CONSTRAINT IF EXISTS members_life_status_check;

ALTER TABLE members
ADD CONSTRAINT members_life_status_check CHECK (
  life_status IN ('living', 'deceased', 'unknown')
);
