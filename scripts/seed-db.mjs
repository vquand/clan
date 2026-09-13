import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { neon } from '@neondatabase/serverless';

import { normalizeSeedData } from './seed-data.mjs';

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
const normalized = normalizeSeedData(data, randomUUID);
await sql.transaction([
  sql`DELETE FROM events`,
  sql`DELETE FROM members`,
  sql`
    INSERT INTO members (
      id, full_name, familiar_name, gender, clan_relation, birth_year, birth_date,
      life_status, death_date, avatar_style, avatar_image_url,
      death_anniversary_lunar_day,
      death_anniversary_lunar_month, hometown, residence, biography
    )
    SELECT
      id::uuid, full_name, familiar_name, gender, clan_relation, birth_year,
      NULLIF(birth_date, '')::date, life_status,
      NULLIF(death_date, '')::date, avatar_style, avatar_image_url,
      death_anniversary_lunar_day,
      death_anniversary_lunar_month, hometown, residence, biography
    FROM jsonb_to_recordset(${JSON.stringify(normalized.members)}::jsonb) AS item(
      id text, full_name text, familiar_name text, gender text, clan_relation text,
      birth_year integer, birth_date text, life_status text, death_date text,
      avatar_style text, avatar_image_url text, death_anniversary_lunar_day integer,
      death_anniversary_lunar_month integer, hometown text, residence text,
      biography text
    )
  `,
  sql`
    INSERT INTO member_parents (child_id, parent_id, parent_order)
    SELECT child_id::uuid, parent_id::uuid, parent_order
    FROM jsonb_to_recordset(${JSON.stringify(normalized.parents)}::jsonb) AS item(
      child_id text, parent_id text, parent_order integer
    )
  `,
  sql`
    INSERT INTO member_spouses (member_a_id, member_b_id)
    SELECT member_a_id::uuid, member_b_id::uuid
    FROM jsonb_to_recordset(${JSON.stringify(normalized.spouses)}::jsonb) AS item(
      member_a_id text, member_b_id text
    )
  `,
  sql`
    INSERT INTO events (
      id, title, type, calendar, day, month, recurrence, event_year,
      location, description
    )
    SELECT
      id::uuid, title, type, calendar, day, month, recurrence, event_year,
      location, description
    FROM jsonb_to_recordset(${JSON.stringify(normalized.events)}::jsonb) AS item(
      id text, title text, type text, calendar text, day integer,
      month integer, recurrence text, event_year integer, location text,
      description text
    )
  `,
  sql`
    INSERT INTO event_members (event_id, member_id)
    SELECT event_id::uuid, member_id::uuid
    FROM jsonb_to_recordset(${JSON.stringify(normalized.eventMembers)}::jsonb) AS item(
      event_id text, member_id text
    )
  `,
  sql`
    INSERT INTO event_solar_dates (event_id, year, solar_date)
    SELECT event_id::uuid, year, solar_date::date
    FROM jsonb_to_recordset(${JSON.stringify(normalized.eventSolarDates)}::jsonb) AS item(
      event_id text, year integer, solar_date text
    )
  `,
]);

console.log(
  `Seeded ${data.members.length} member rows and ${data.events.length} event rows`,
);
