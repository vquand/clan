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
await sql.transaction([
  sql`DELETE FROM members`,
  sql`DELETE FROM events`,
  sql`
    INSERT INTO members (id, data)
    SELECT member->>'id', member
    FROM jsonb_array_elements(${JSON.stringify(data.members)}::jsonb) AS member
  `,
  sql`
    INSERT INTO events (id, data)
    SELECT event->>'id', event
    FROM jsonb_array_elements(${JSON.stringify(data.events)}::jsonb) AS event
  `,
]);

console.log(
  `Seeded ${data.members.length} member rows and ${data.events.length} event rows`,
);
