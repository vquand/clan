import { writeFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { CLAN_TABLES } from './d1-data.mjs';

const output = process.argv[2];
if (!process.env.DATABASE_URL || !output) {
  throw new Error(
    'Set DATABASE_URL and provide a new private snapshot path: npm run db:export:neon -- /private/path/neon.json',
  );
}
const sql = neon(process.env.DATABASE_URL);
const tables = Object.keys(CLAN_TABLES);
const rows = await sql.transaction(
  tables.map((table) => sql.query(`SELECT * FROM ${table}`)),
  {
    isolationLevel: 'RepeatableRead',
    readOnly: true,
  },
);
const snapshot = {
  format: 1,
  exportedAt: new Date().toISOString(),
  tables: Object.fromEntries(
    tables.map((table, index) => [table, rows[index]]),
  ),
};
await writeFile(output, JSON.stringify(snapshot, null, 2), {
  mode: 0o600,
  flag: 'wx',
});
console.log(
  `Exported a consistent, read-only snapshot: ${tables.map((table, index) => `${table}=${rows[index].length}`).join(', ')}`,
);
