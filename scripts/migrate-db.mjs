import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL must be set before running database migrations',
  );
}

const sql = neon(databaseUrl);
const migrationsDirectory = fileURLToPath(
  new URL('../db/migrations', import.meta.url),
);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
  .sort();

for (const fileName of migrationFiles) {
  const migration = await readFile(
    `${migrationsDirectory}/${fileName}`,
    'utf8',
  );
  await sql.query(migration);
  console.log(`Applied database migration ${fileName}`);
}
