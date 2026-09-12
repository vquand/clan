import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before seeding the database');
}

const source = process.env.CLAN_DATA_JSON?.trim()
  ? process.env.CLAN_DATA_JSON
  : process.env.CLAN_DATA_FILE?.trim()
    ? await readFile(resolve(process.env.CLAN_DATA_FILE), 'utf8')
    : await readFile(
        resolve(process.cwd(), 'examples/clan-data.example.json'),
        'utf8',
      );

let data;
try {
  data = JSON.parse(source);
} catch {
  throw new Error('CLAN_DATA_JSON or the seed file must contain valid JSON');
}

if (
  !data ||
  typeof data !== 'object' ||
  !Array.isArray(data.members) ||
  !Array.isArray(data.events)
) {
  throw new Error('Seed data must be an object with members and events arrays');
}

const sql = neon(databaseUrl);
await sql`
  INSERT INTO clan_data (id, members, events)
  VALUES (
    'default',
    ${JSON.stringify(data.members)}::jsonb,
    ${JSON.stringify(data.events)}::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    members = EXCLUDED.members,
    events = EXCLUDED.events,
    updated_at = NOW()
`;

console.log(
  `Seeded clan_data.default with ${data.members.length} members and ${data.events.length} events`,
);
