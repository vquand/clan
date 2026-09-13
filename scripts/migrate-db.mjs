import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { neon } from '@neondatabase/serverless';

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

for (const fileName of migrationFiles) {
  const appliedRows = await sql`
    SELECT 1
    FROM schema_migrations
    WHERE file_name = ${fileName}
  `;
  if (appliedRows.length > 0) {
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
  console.log(`Applied database migration ${fileName}`);
}
