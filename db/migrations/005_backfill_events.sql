INSERT INTO events (id, data)
SELECT event->>'id', event
FROM clan_data
CROSS JOIN LATERAL jsonb_array_elements(clan_data.events) AS event
WHERE clan_data.id = 'default'
ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = NOW();
