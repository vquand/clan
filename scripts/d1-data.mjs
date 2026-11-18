import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { mergeDefaultLunarEvents, normalizeSeedData } from './seed-data.mjs';
import { validateParentGraph } from '../server/admin-validation.mjs';

export const CLAN_TABLES = {
  members: ['id'],
  clan_locations: ['id'],
  events: ['id'],
  member_parents: ['child_id', 'parent_id'],
  member_spouses: ['member_a_id', 'member_b_id'],
  event_members: ['event_id', 'member_id'],
  event_solar_dates: ['event_id', 'year'],
};

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && !value.includes('\0'))
    return `'${value.replaceAll("'", "''")}'`;
  throw new Error(
    'Import values must be strings, finite numbers, booleans, or null',
  );
}

export function buildD1Import(snapshot) {
  if (snapshot?.format !== 1 || !snapshot.tables)
    throw new Error('Invalid clan database snapshot');
  const statements = ['PRAGMA defer_foreign_keys = ON;'];
  for (const [table, keys] of Object.entries(CLAN_TABLES)) {
    const rows = snapshot.tables[table];
    if (!Array.isArray(rows))
      throw new Error(`Snapshot is missing table ${table}`);
    for (const source of rows) {
      const row = Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== undefined),
      );
      const columns = Object.keys(row);
      if (
        !columns.length ||
        columns.some((column) => !/^[a-z_]+$/.test(column)) ||
        keys.some((key) => row[key] === null || row[key] === undefined)
      ) {
        throw new Error(`Invalid columns or primary key in ${table}`);
      }
      statements.push(
        `INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((column) => sqlValue(row[column])).join(', ')}) ON CONFLICT (${keys.join(', ')}) DO NOTHING;`,
      );
    }
  }
  return `${statements.join('\n')}\n`;
}

export function seedSnapshot(data) {
  validateParentGraph(data.members);
  const normalized = normalizeSeedData(
    mergeDefaultLunarEvents(data),
    randomUUID,
  );
  return {
    format: 1,
    tables: {
      members: normalized.members,
      clan_locations: normalized.locations,
      events: normalized.events.map((row) => ({
        ...row,
        location_address: row.location_address ?? '',
      })),
      member_parents: normalized.parents,
      member_spouses: normalized.spouses,
      event_members: normalized.eventMembers,
      event_solar_dates: normalized.eventSolarDates,
    },
  };
}

function comparableRows(rows, columns) {
  return rows
    .map((row) =>
      JSON.stringify(
        columns.map((column) => {
          const value = row[column];
          return typeof value === 'boolean' ? Number(value) : (value ?? null);
        }),
      ),
    )
    .sort((left, right) => left.localeCompare(right));
}

export function assertSameTable(table, expected, actual) {
  const columns = [...new Set(expected.flatMap(Object.keys))].sort(
    (left, right) => left.localeCompare(right),
  );
  if (
    JSON.stringify(comparableRows(expected, columns)) !==
    JSON.stringify(comparableRows(actual, columns))
  ) {
    throw new Error(
      `Verification failed for ${table}: rows or values differ (source ${expected.length}, D1 ${actual.length})`,
    );
  }
}

async function main() {
  const [command, input, output] = process.argv.slice(2);
  if (command === 'seed' && input) {
    const data = JSON.parse(
      process.env.CLAN_DATA_JSON ||
        (await readFile(
          process.env.CLAN_DATA_FILE ||
            new URL('../examples/clan-data.example.json', import.meta.url),
          'utf8',
        )),
    );
    await writeFile(input, buildD1Import(seedSnapshot(data)), {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(
      'Created D1 seed SQL. Import it into an empty database; existing records are never deleted.',
    );
    return;
  }
  if (command === 'convert' && input && output) {
    await writeFile(
      output,
      buildD1Import(JSON.parse(await readFile(input, 'utf8'))),
      { mode: 0o600, flag: 'wx' },
    );
    console.log(
      'Created D1 import SQL. UUIDs and all exported column values are preserved.',
    );
    return;
  }
  if (
    command === 'verify' &&
    input &&
    ['--local', '--remote'].includes(output)
  ) {
    const snapshot = JSON.parse(await readFile(input, 'utf8'));
    buildD1Import(snapshot);
    const run = promisify(execFile);
    const wrangler = new URL(
      '../node_modules/wrangler/bin/wrangler.js',
      import.meta.url,
    );
    for (const table of Object.keys(CLAN_TABLES)) {
      const { stdout } = await run(
        process.execPath,
        [
          wrangler.pathname,
          '--config',
          'wrangler.worker.jsonc',
          'd1',
          'execute',
          'DB',
          output,
          '--command',
          `SELECT * FROM ${table}`,
          '--json',
        ],
        { maxBuffer: 128 * 1024 * 1024 },
      );
      const results = JSON.parse(stdout);
      assertSameTable(
        table,
        snapshot.tables[table],
        results.flatMap((result) => result.results),
      );
      console.log(`Verified ${table}: ${snapshot.tables[table].length} rows`);
    }
    return;
  }
  throw new Error(
    'Usage: d1-data.mjs seed <new.sql> | convert <snapshot.json> <new.sql> | verify <snapshot.json> --local|--remote',
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await main();
