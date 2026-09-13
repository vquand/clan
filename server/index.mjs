import { createServer } from 'node:http';

import { neon } from '@neondatabase/serverless';

import { assembleClanData } from './clan-data.mjs';

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

  const [
    memberRows,
    parentRows,
    spouseRows,
    eventRows,
    eventMemberRows,
    eventSolarDateRows,
  ] = await Promise.all([
    sql`
      SELECT
        id, full_name, familiar_name, gender, clan_relation, birth_year, birth_date,
        life_status, death_date, death_anniversary_lunar_day,
        death_anniversary_lunar_month, hometown, residence, biography
      FROM members
      ORDER BY full_name, id
    `,
    sql`
      SELECT child_id, parent_id
      FROM member_parents
      ORDER BY child_id, parent_order, parent_id
    `,
    sql`
      SELECT member_a_id, member_b_id
      FROM member_spouses
      ORDER BY member_a_id, member_b_id
    `,
    sql`
      SELECT
        id, title, type, calendar, day, month, recurrence,
        event_year, location, description
      FROM events
      ORDER BY month, day, title, id
    `,
    sql`
      SELECT event_id, member_id
      FROM event_members
      ORDER BY event_id, member_id
    `,
    sql`
      SELECT event_id, year, solar_date
      FROM event_solar_dates
      ORDER BY event_id, year
    `,
  ]);

  const data = assembleClanData({
    memberRows,
    parentRows,
    spouseRows,
    eventRows,
    eventMemberRows,
    eventSolarDateRows,
  });
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
