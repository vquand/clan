import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createApiHandler as createHandler } from './api.mjs';

for (const envFile of ['.env', 'server/.env']) {
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

const demoDatabasePath = resolve(process.cwd(), 'data/db.json');
let demoClanData;

function isClanData(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.members) &&
    Array.isArray(value.events)
  );
}

function loadDemoClanData() {
  if (demoClanData) return structuredClone(demoClanData);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(demoDatabasePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to load the demo database at ${demoDatabasePath}: ${error.message}`,
    );
  }
  if (!isClanData(parsed)) {
    throw new Error(
      `The demo database at ${demoDatabasePath} must contain members and events arrays`,
    );
  }
  demoClanData = parsed;
  return structuredClone(demoClanData);
}

export function createApiHandler(options = {}) {
  return createHandler({
    demoData: loadDemoClanData(),
    ...options,
  });
}

export const server = createServer(createApiHandler());

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const port = Number(process.env.PORT ?? 10000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Clan demo API listening on port ${port}`);
  });
}
