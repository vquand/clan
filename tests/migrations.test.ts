import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { isCurrentSchema } from '../scripts/migration-state.mjs';
import { splitSqlStatements } from '../scripts/sql-statements.mjs';

const migrationsDirectory = fileURLToPath(
  new URL('../db/migrations/', import.meta.url),
);
const archiveDirectory = fileURLToPath(
  new URL('../db/migrations-archive/', import.meta.url),
);

void test('keeps one active baseline and archives the superseded migration chain', async () => {
  const activeMigrations = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
  const archivedMigrations = (await readdir(archiveDirectory))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  assert.deepEqual(activeMigrations, ['001_baseline.sql']);
  assert.equal(archivedMigrations.length, 15);

  const baseline = await readFile(
    fileURLToPath(
      new URL('../db/migrations/001_baseline.sql', import.meta.url),
    ),
    'utf8',
  );
  for (const marker of [
    'CREATE TABLE members',
    'CREATE TABLE clan_locations',
    'is_clan_head BOOLEAN',
    'avatar_image_url TEXT',
    'location_id UUID',
  ]) {
    assert.match(baseline, new RegExp(marker));
  }
  assert.ok(splitSqlStatements(baseline).length > 20);
});

void test('recognizes the already-migrated production schema', () => {
  assert.equal(
    isCurrentSchema({
      has_members: true,
      has_member_parents: true,
      has_member_spouses: true,
      has_events: true,
      has_event_members: true,
      has_event_solar_dates: true,
      has_clan_locations: true,
      has_member_avatar_image: true,
      has_clan_head_flags: true,
      has_event_location: true,
    }),
    true,
  );
  assert.equal(
    isCurrentSchema({
      has_members: true,
      has_member_parents: true,
      has_member_spouses: true,
      has_events: true,
      has_event_members: true,
      has_event_solar_dates: true,
      has_clan_locations: true,
      has_member_avatar_image: true,
      has_clan_head_flags: false,
      has_event_location: true,
    }),
    false,
  );
});
