INSERT INTO members (id, data)
SELECT member->>'id', member
FROM clan_data
CROSS JOIN LATERAL jsonb_array_elements(clan_data.members) AS member
WHERE clan_data.id = 'default'
ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = NOW();
