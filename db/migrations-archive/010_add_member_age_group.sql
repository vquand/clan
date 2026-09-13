ALTER TABLE members
ADD COLUMN age_group TEXT
CHECK (age_group IN ('senior'));

COMMENT ON COLUMN members.age_group IS
  'Optional approximate age group used when exact birth and death dates are unavailable.';
