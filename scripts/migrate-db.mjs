import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL must be set before running database migrations',
  );
}

const migrationPath = fileURLToPath(
  new URL('../db/migrations/001_create_clan_data.sql', import.meta.url),
);
const migration = await readFile(migrationPath, 'utf8');
const sql = neon(databaseUrl);

await sql.query(migration);
console.log('Applied database migration 001_create_clan_data');
