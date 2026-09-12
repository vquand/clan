import { createServer } from 'node:http';

import { neon } from '@neondatabase/serverless';

const port = Number(process.env.PORT ?? 10000);
const databaseUrl = process.env.DATABASE_URL?.trim();
const sql = databaseUrl ? neon(databaseUrl) : null;
const allowedOrigins = (process.env.CORS_ORIGINS ?? '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function getCorsOrigin(requestOrigin) {
  if (allowedOrigins.includes('*')) return '*';
  return requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : null;
}

function sendJson(response, status, payload, requestOrigin) {
  const corsOrigin = getCorsOrigin(requestOrigin);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Origin',
  };
  if (corsOrigin) {
    headers['access-control-allow-origin'] = corsOrigin;
    headers['access-control-allow-methods'] = 'GET, OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type';
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function parseJsonb(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function isClanData(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.members) &&
    Array.isArray(value.events)
  );
}

async function getClanData() {
  if (!sql) throw new Error('DATABASE_URL is not configured');

  const [memberRows, eventRows] = await Promise.all([
    sql`SELECT data FROM members ORDER BY id`,
    sql`SELECT data FROM events ORDER BY id`,
  ]);

  const data = {
    members: memberRows.map((row) => parseJsonb(row.data)),
    events: eventRows.map((row) => parseJsonb(row.data)),
  };
  return isClanData(data) ? data : null;
}

const server = createServer(async (request, response) => {
  const requestOrigin = request.headers.origin;
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {}, requestOrigin);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' }, requestOrigin);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/clan') {
    try {
      const data = await getClanData();
      if (!data) {
        sendJson(
          response,
          404,
          { error: 'Clan data has not been seeded' },
          requestOrigin,
        );
        return;
      }
      sendJson(response, 200, data, requestOrigin);
    } catch (error) {
      console.error('Failed to load clan data', error);
      sendJson(
        response,
        503,
        { error: 'Clan data is temporarily unavailable' },
        requestOrigin,
      );
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found' }, requestOrigin);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Clan API listening on port ${port}`);
});
