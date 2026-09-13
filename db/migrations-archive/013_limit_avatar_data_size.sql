ALTER TABLE members
ADD CONSTRAINT members_avatar_image_data_size CHECK (
  avatar_image_url IS NULL OR
  avatar_image_url NOT LIKE 'data:image/%' OR
  octet_length(avatar_image_url) <= 24000
);

COMMENT ON CONSTRAINT members_avatar_image_data_size ON members IS
  'Compressed custom avatar data URLs are limited to 24 KB.';
