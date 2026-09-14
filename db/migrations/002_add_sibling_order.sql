ALTER TABLE members
ADD COLUMN sibling_order SMALLINT CHECK (sibling_order > 0);

COMMENT ON COLUMN members.sibling_order IS
  'Optional oldest-to-youngest order used when displaying siblings left to right.';
