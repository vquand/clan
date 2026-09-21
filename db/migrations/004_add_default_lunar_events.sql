-- Keep the standard Vietnamese lunar observances available in production even
-- when the private family seed file does not define them yet. The calendar
-- calculates each year's solar date from the lunar date.
INSERT INTO events (
  id,
  title,
  type,
  calendar,
  day,
  month,
  recurrence,
  location,
  description
)
SELECT
  defaults.event_id::uuid,
  defaults.title,
  defaults.type,
  defaults.calendar,
  defaults.day,
  defaults.month,
  defaults.recurrence,
  defaults.location,
  defaults.description
FROM (
  VALUES
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000001',
      'Tết Nguyên Đán',
      'gathering',
      'lunar',
      1,
      1,
      'annual',
      '',
      'Ngày đầu năm mới âm lịch, dịp sum họp lớn của gia đình.'
    ),
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000002',
      'Tết Nguyên Tiêu',
      'gathering',
      'lunar',
      15,
      1,
      'annual',
      '',
      'Rằm tháng Giêng, ngày cầu bình an và tưởng nhớ tổ tiên.'
    ),
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000003',
      'Tết Hàn Thực',
      'gathering',
      'lunar',
      3,
      3,
      'annual',
      '',
      'Ngày bánh trôi, bánh chay và tưởng nhớ tổ tiên.'
    ),
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000004',
      'Tết Đoan Ngọ',
      'gathering',
      'lunar',
      5,
      5,
      'annual',
      '',
      'Ngày mùng 5 tháng 5 âm lịch.'
    ),
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000005',
      'Lễ Vu Lan',
      'gathering',
      'lunar',
      15,
      7,
      'annual',
      '',
      'Dịp tưởng nhớ và tri ân cha mẹ, ông bà.'
    ),
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000006',
      'Trung thu sum họp',
      'gathering',
      'lunar',
      15,
      8,
      'annual',
      '',
      'Rằm tháng Tám âm lịch, dịp sum họp và vui Tết Trung Thu.'
    ),
    (
      'd9a6d1d1-0e01-4a01-8a01-000000000007',
      'Ông Công, Ông Táo',
      'gathering',
      'lunar',
      23,
      12,
      'annual',
      '',
      'Ngày tiễn ông Công, ông Táo về trời.'
    )
) AS defaults(
  event_id,
  title,
  type,
  calendar,
  day,
  month,
  recurrence,
  location,
  description
)
WHERE NOT EXISTS (
  SELECT 1
  FROM events AS existing
  WHERE existing.calendar = defaults.calendar
    AND existing.day = defaults.day
    AND existing.month = defaults.month
);
