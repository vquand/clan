ALTER TABLE members
ADD COLUMN avatar_style TEXT NOT NULL DEFAULT 'default'
CHECK (avatar_style IN ('default', 'style-1', 'style-2', 'style-3'));

ALTER TABLE members
ALTER COLUMN avatar_style DROP DEFAULT;

ALTER TABLE members
ADD COLUMN avatar_image_url TEXT
CHECK (avatar_image_url IS NULL OR btrim(avatar_image_url) <> '');

COMMENT ON COLUMN members.avatar_style IS
  'Optional people-icon hairstyle selection; default keeps the standard icon.';

COMMENT ON COLUMN members.avatar_image_url IS
  'Optional uploaded or hosted portrait URL; when present it replaces the generated icon.';
