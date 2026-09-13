import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { neon } from '@neondatabase/serverless';

import {
  BASELINE_MIGRATION_FILE,
  isCurrentSchema,
} from './migration-state.mjs';
import { splitSqlStatements } from './sql-statements.mjs';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL must be set before running database migrations',
  );
}

const sql = neon(databaseUrl);
await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    file_name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const migrationsDirectory = fileURLToPath(
  new URL('../db/migrations', import.meta.url),
);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
  .sort();

const appliedRows = await sql`
  SELECT file_name
  FROM schema_migrations
`;
const appliedFiles = new Set(appliedRows.map((row) => row.file_name));

if (
  migrationFiles.includes(BASELINE_MIGRATION_FILE) &&
  !appliedFiles.has(BASELINE_MIGRATION_FILE)
) {
  const schemaRows = await sql`
    SELECT
      to_regclass('public.members') IS NOT NULL AS has_members,
      to_regclass('public.member_parents') IS NOT NULL AS has_member_parents,
      to_regclass('public.member_spouses') IS NOT NULL AS has_member_spouses,
      to_regclass('public.events') IS NOT NULL AS has_events,
      to_regclass('public.event_members') IS NOT NULL AS has_event_members,
      to_regclass('public.event_solar_dates') IS NOT NULL AS has_event_solar_dates,
      to_regclass('public.clan_locations') IS NOT NULL AS has_clan_locations,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'members'
          AND column_name = 'avatar_image_url'
      ) AS has_member_avatar_image,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'members'
          AND column_name = 'is_clan_head'
      ) AS has_clan_head_flags,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'location_id'
      ) AS has_event_location
  `;
  if (isCurrentSchema(schemaRows[0])) {
    await sql`
      INSERT INTO schema_migrations (file_name)
      VALUES (${BASELINE_MIGRATION_FILE})
      ON CONFLICT (file_name) DO NOTHING
    `;
    appliedFiles.add(BASELINE_MIGRATION_FILE);
    console.log(
      `Recorded database migration ${BASELINE_MIGRATION_FILE} for the existing schema`,
    );
  }
}

for (const fileName of migrationFiles) {
  if (appliedFiles.has(fileName)) {
    console.log(`Skipped database migration ${fileName}`);
    continue;
  }

  const migration = await readFile(
    `${migrationsDirectory}/${fileName}`,
    'utf8',
  );
  const statements = splitSqlStatements(migration);
  if (statements.length === 0) {
    throw new Error(
      `Database migration ${fileName} contains no SQL statements`,
    );
  }
  await sql.transaction((transaction) => [
    ...statements.map((statement) => transaction.query(statement)),
    transaction`
      INSERT INTO schema_migrations (file_name)
      VALUES (${fileName})
      ON CONFLICT (file_name) DO NOTHING
    `,
  ]);
  appliedFiles.add(fileName);
  console.log(`Applied database migration ${fileName}`);
}
