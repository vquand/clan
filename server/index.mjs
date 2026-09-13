import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';

import { neon } from '@neondatabase/serverless';

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  credentialsMatch,
  createSessionToken,
  getAdminConfig,
  getCookie,
  parseCookies,
  verifySessionToken,
} from './admin-auth.mjs';
import {
  normalizeEventInput,
  normalizeMemberInput,
  validateParentGraph,
} from './admin-validation.mjs';
import { assembleClanData } from './clan-data.mjs';

for (const envFile of ['.env', 'server/.env']) {
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

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

function sendJson(response, status, payload, requestOrigin, extraHeaders = {}) {
  const corsOrigin = getCorsOrigin(requestOrigin);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Origin',
    ...extraHeaders,
  };
  if (corsOrigin) {
    headers['access-control-allow-origin'] = corsOrigin;
    headers['access-control-allow-methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type';
    if (corsOrigin !== '*') headers['access-control-allow-credentials'] = 'true';
  }
  response.writeHead(status, headers);
  if (status === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload));
}

function errorPayload(code, message, details) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

function isClanData(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.members) &&
    Array.isArray(value.events)
  );
}

export async function getClanData(database = sql) {
  if (!database) throw new Error('DATABASE_URL is not configured');

  const [memberRows, parentRows, spouseRows, eventRows, eventMemberRows, eventSolarDateRows] =
    await Promise.all([
      database`
        SELECT
          id, full_name, familiar_name, gender, clan_relation, birth_year, birth_date,
          life_status, death_year, death_date, age_at_death, age_at_death_qualifier,
          age_group, avatar_style, avatar_image_url,
          death_anniversary_lunar_day,
          death_anniversary_lunar_month, hometown, residence, biography
        FROM members
        ORDER BY full_name, id
      `,
      database`
        SELECT child_id, parent_id
        FROM member_parents
        ORDER BY child_id, parent_order, parent_id
      `,
      database`
        SELECT member_a_id, member_b_id
        FROM member_spouses
        ORDER BY member_a_id, member_b_id
      `,
      database`
        SELECT
          id, title, type, calendar, day, month, recurrence,
          event_year, location, description
        FROM events
        ORDER BY month, day, title, id
      `,
      database`
        SELECT event_id, member_id
        FROM event_members
        ORDER BY event_id, member_id
      `,
      database`
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

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw Object.assign(new Error('Request body is too large'), { status: 413 });
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Request body must be an object');
    }
    return value;
  } catch (error) {
    if (error?.status) throw error;
    throw Object.assign(new Error('Request body must be valid JSON'), { status: 400 });
  }
}

function requestAdmin(request, env) {
  const config = getAdminConfig(env);
  if (!config) {
    throw Object.assign(new Error('Admin credentials are not configured'), {
      status: 503,
      code: 'ADMIN_NOT_CONFIGURED',
    });
  }
  const token = getCookie(
    parseCookies(request.headers.cookie ?? ''),
    ADMIN_SESSION_COOKIE,
  );
  const username = verifySessionToken(token, config.sessionSecret);
  if (username !== config.username) {
    throw Object.assign(new Error('Admin authentication is required'), {
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  }
  return config;
}

function uuid(value, field) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw Object.assign(new Error(`${field} must be a UUID`), {
      status: 422,
      code: 'VALIDATION_ERROR',
    });
  }
  return value;
}

async function assertMemberIds(database, memberIds) {
  const ids = memberIds.map((id) => uuid(id, 'Relationship ID'));
  const rows = await Promise.all(
    ids.map((id) => database`SELECT id FROM members WHERE id = ${id}::uuid`),
  );
  const missing = ids.filter((_, index) => rows[index].length === 0);
  if (missing.length > 0) {
    throw Object.assign(new Error('One or more related members do not exist'), {
      status: 422,
      code: 'INVALID_RELATIONSHIP',
      details: { missingMemberIds: missing },
    });
  }
}

function normalizeAdminInput(normalizer, body, options) {
  try {
    return normalizer(body, options);
  } catch (error) {
    throw Object.assign(new Error(error.message), {
      status: 422,
      code: 'VALIDATION_ERROR',
    });
  }
}

function memberAsInput(member) {
  return {
    ...member,
    deathAnniversaryLunarDay: member.deathAnniversaryLunar?.day,
    deathAnniversaryLunarMonth: member.deathAnniversaryLunar?.month,
  };
}

function eventAsInput(event) {
  return { ...event, year: event.year };
}

async function assertMemberRelationships(database, data, memberId, parentIds) {
  await assertMemberIds(database, parentIds);
  const nextMembers = data.members.filter((member) => member.id !== memberId);
  nextMembers.push({ id: memberId, parentIds });
  try {
    validateParentGraph(nextMembers);
  } catch (error) {
    throw Object.assign(new Error(error.message), {
      status: 422,
      code: 'INVALID_RELATIONSHIP',
    });
  }
}

function memberQueries(database, id, input) {
  return [
    database`
      INSERT INTO members (
        id, full_name, familiar_name, gender, clan_relation, birth_year, birth_date,
        life_status, death_year, death_date, age_at_death, age_at_death_qualifier,
        age_group, avatar_style, avatar_image_url,
        death_anniversary_lunar_day, death_anniversary_lunar_month,
        hometown, residence, biography
      ) VALUES (
        ${id}::uuid, ${input.full_name}, ${input.familiar_name}, ${input.gender},
        ${input.clan_relation}, ${input.birth_year}, ${input.birth_date},
        ${input.life_status}, ${input.death_year}, ${input.death_date},
        ${input.age_at_death}, ${input.age_at_death_qualifier}, ${input.age_group},
        ${input.avatar_style}, ${input.avatar_image_url},
        ${input.death_anniversary_lunar_day}, ${input.death_anniversary_lunar_month},
        ${input.hometown}, ${input.residence}, ${input.biography}
      )
    `,
    ...input.parentIds.map(
      (parentId, index) => database`
        INSERT INTO member_parents (child_id, parent_id, parent_order)
        VALUES (${id}::uuid, ${parentId}::uuid, ${index + 1})
      `,
    ),
    ...input.spouseIds.map(
      (spouseId) => database`
        INSERT INTO member_spouses (member_a_id, member_b_id)
        VALUES (LEAST(${id}::uuid, ${spouseId}::uuid), GREATEST(${id}::uuid, ${spouseId}::uuid))
        ON CONFLICT DO NOTHING
      `,
    ),
  ];
}

async function createMember(database, body) {
  const input = normalizeAdminInput(normalizeMemberInput, body);
  const data = await getClanData(database);
  await assertMemberRelationships(database, data, 'new-member', input.parentIds);
  await assertMemberIds(database, input.spouseIds);
  const id = randomUUID();
  await database.transaction(memberQueries(database, id, input));
  return (await getClanData(database)).members.find((member) => member.id === id);
}

async function updateMember(database, id, body) {
  uuid(id, 'Member ID');
  const data = await getClanData(database);
  const current = data.members.find((member) => member.id === id);
  if (!current) {
    throw Object.assign(new Error('Member not found'), { status: 404, code: 'NOT_FOUND' });
  }
  const input = normalizeAdminInput(
    normalizeMemberInput,
    { ...memberAsInput(current), ...body },
    { memberId: id },
  );
  await assertMemberRelationships(database, data, id, input.parentIds);
  await assertMemberIds(database, input.spouseIds);

  const queries = [
    database`
      UPDATE members
      SET full_name = ${input.full_name}, familiar_name = ${input.familiar_name},
          gender = ${input.gender}, clan_relation = ${input.clan_relation},
          birth_year = ${input.birth_year}, birth_date = ${input.birth_date},
          life_status = ${input.life_status}, death_year = ${input.death_year},
          death_date = ${input.death_date}, age_at_death = ${input.age_at_death},
          age_at_death_qualifier = ${input.age_at_death_qualifier},
          age_group = ${input.age_group}, avatar_style = ${input.avatar_style},
          avatar_image_url = ${input.avatar_image_url},
          death_anniversary_lunar_day = ${input.death_anniversary_lunar_day},
          death_anniversary_lunar_month = ${input.death_anniversary_lunar_month},
          hometown = ${input.hometown}, residence = ${input.residence},
          biography = ${input.biography}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `,
    database`DELETE FROM member_parents WHERE child_id = ${id}::uuid`,
    database`DELETE FROM member_spouses WHERE member_a_id = ${id}::uuid OR member_b_id = ${id}::uuid`,
    ...input.parentIds.map(
      (parentId, index) => database`
        INSERT INTO member_parents (child_id, parent_id, parent_order)
        VALUES (${id}::uuid, ${parentId}::uuid, ${index + 1})
      `,
    ),
    ...input.spouseIds.map(
      (spouseId) => database`
        INSERT INTO member_spouses (member_a_id, member_b_id)
        VALUES (LEAST(${id}::uuid, ${spouseId}::uuid), GREATEST(${id}::uuid, ${spouseId}::uuid))
        ON CONFLICT DO NOTHING
      `,
    ),
  ];
  await database.transaction(queries);
  return (await getClanData(database)).members.find((member) => member.id === id);
}

async function deleteMember(database, id) {
  uuid(id, 'Member ID');
  const result = await database`DELETE FROM members WHERE id = ${id}::uuid RETURNING id`;
  if (result.length === 0) {
    throw Object.assign(new Error('Member not found'), { status: 404, code: 'NOT_FOUND' });
  }
}

function eventQueries(database, id, input) {
  return [
    database`
      INSERT INTO events (
        id, title, type, calendar, day, month, recurrence, event_year,
        location, description
      ) VALUES (
        ${id}::uuid, ${input.title}, ${input.type}, ${input.calendar}, ${input.day},
        ${input.month}, ${input.recurrence}, ${input.event_year},
        ${input.location}, ${input.description}
      )
    `,
    ...input.relatedMemberIds.map(
      (memberId) => database`
        INSERT INTO event_members (event_id, member_id)
        VALUES (${id}::uuid, ${memberId}::uuid)
      `,
    ),
    ...Object.entries(input.solarDates).map(
      ([year, solarDate]) => database`
        INSERT INTO event_solar_dates (event_id, year, solar_date)
        VALUES (${id}::uuid, ${Number(year)}, ${solarDate})
      `,
    ),
  ];
}

async function createEvent(database, body) {
  const input = normalizeAdminInput(normalizeEventInput, body);
  const id = randomUUID();
  await assertMemberIds(database, input.relatedMemberIds);
  await database.transaction(eventQueries(database, id, input));
  return (await getClanData(database)).events.find((event) => event.id === id);
}

async function updateEvent(database, id, body) {
  uuid(id, 'Event ID');
  const data = await getClanData(database);
  const current = data.events.find((event) => event.id === id);
  if (!current) {
    throw Object.assign(new Error('Event not found'), { status: 404, code: 'NOT_FOUND' });
  }
  const input = normalizeAdminInput(normalizeEventInput, {
    ...eventAsInput(current),
    ...body,
  });
  await assertMemberIds(database, input.relatedMemberIds);
  const queries = [
    database`
      UPDATE events
      SET title = ${input.title}, type = ${input.type}, calendar = ${input.calendar},
          day = ${input.day}, month = ${input.month}, recurrence = ${input.recurrence},
          event_year = ${input.event_year}, location = ${input.location},
          description = ${input.description}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `,
    database`DELETE FROM event_members WHERE event_id = ${id}::uuid`,
    database`DELETE FROM event_solar_dates WHERE event_id = ${id}::uuid`,
    ...input.relatedMemberIds.map(
      (memberId) => database`
        INSERT INTO event_members (event_id, member_id)
        VALUES (${id}::uuid, ${memberId}::uuid)
      `,
    ),
    ...Object.entries(input.solarDates).map(
      ([year, solarDate]) => database`
        INSERT INTO event_solar_dates (event_id, year, solar_date)
        VALUES (${id}::uuid, ${Number(year)}, ${solarDate})
      `,
    ),
  ];
  await database.transaction(queries);
  return (await getClanData(database)).events.find((event) => event.id === id);
}

async function deleteEvent(database, id) {
  uuid(id, 'Event ID');
  const result = await database`DELETE FROM events WHERE id = ${id}::uuid RETURNING id`;
  if (result.length === 0) {
    throw Object.assign(new Error('Event not found'), { status: 404, code: 'NOT_FOUND' });
  }
}

function cookieHeader(token, maxAge, secure) {
  return [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

async function handleAdminRequest(request, response, url, env, database) {
  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    const config = getAdminConfig(env);
    const token = getCookie(
      parseCookies(request.headers.cookie ?? ''),
      ADMIN_SESSION_COOKIE,
    );
    const authenticated = Boolean(
      config && verifySessionToken(token, config.sessionSecret) === config.username,
    );
    sendJson(response, 200, { authenticated }, request.headers.origin);
    return true;
  }

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    const config = getAdminConfig(env);
    if (!config) {
      sendJson(
        response,
        503,
        errorPayload('ADMIN_NOT_CONFIGURED', 'Admin credentials are not configured'),
        request.headers.origin,
      );
      return true;
    }
    const body = await readJsonBody(request);
    if (!credentialsMatch(body.username, body.password, config)) {
      sendJson(
        response,
        401,
        errorPayload('INVALID_CREDENTIALS', 'Invalid admin username or password'),
        request.headers.origin,
      );
      return true;
    }
    const token = createSessionToken(config.username, config.sessionSecret);
    sendJson(
      response,
      200,
      { authenticated: true },
      request.headers.origin,
      {
        'set-cookie': cookieHeader(
          token,
          ADMIN_SESSION_TTL_SECONDS,
          env.NODE_ENV === 'production',
        ),
      },
    );
    return true;
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    sendJson(response, 200, { authenticated: false }, request.headers.origin, {
      'set-cookie': cookieHeader('', 0, env.NODE_ENV === 'production'),
    });
    return true;
  }

  if (!url.pathname.startsWith('/api/admin/')) return false;
  requestAdmin(request, env);
  if (!database) throw new Error('DATABASE_URL is not configured');

  if (url.pathname === '/api/admin/data' && request.method === 'GET') {
    const data = await getClanData(database);
    sendJson(
      response,
      data ? 200 : 404,
      data ?? errorPayload('NOT_FOUND', 'Clan data has not been seeded'),
      request.headers.origin,
    );
    return true;
  }

  const memberMatch = url.pathname.match(/^\/api\/admin\/members(?:\/([^/]+))?$/);
  if (memberMatch) {
    const id = memberMatch[1] ? decodeURIComponent(memberMatch[1]) : null;
    if (request.method === 'POST' && !id) {
      const member = await createMember(database, await readJsonBody(request));
      sendJson(response, 201, member, request.headers.origin);
      return true;
    }
    if (request.method === 'PATCH' && id) {
      const member = await updateMember(database, id, await readJsonBody(request));
      sendJson(response, 200, member, request.headers.origin);
      return true;
    }
    if (request.method === 'DELETE' && id) {
      await deleteMember(database, id);
      sendJson(response, 200, { deleted: true }, request.headers.origin);
      return true;
    }
  }

  const eventMatch = url.pathname.match(/^\/api\/admin\/events(?:\/([^/]+))?$/);
  if (eventMatch) {
    const id = eventMatch[1] ? decodeURIComponent(eventMatch[1]) : null;
    if (request.method === 'POST' && !id) {
      const event = await createEvent(database, await readJsonBody(request));
      sendJson(response, 201, event, request.headers.origin);
      return true;
    }
    if (request.method === 'PATCH' && id) {
      const event = await updateEvent(database, id, await readJsonBody(request));
      sendJson(response, 200, event, request.headers.origin);
      return true;
    }
    if (request.method === 'DELETE' && id) {
      await deleteEvent(database, id);
      sendJson(response, 200, { deleted: true }, request.headers.origin);
      return true;
    }
  }

  sendJson(
    response,
    404,
    errorPayload('NOT_FOUND', 'Admin resource not found'),
    request.headers.origin,
  );
  return true;
}

export function createApiHandler({ database = sql, env = process.env } = {}) {
  return async (request, response) => {
    const requestOrigin = request.headers.origin;
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    );

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {}, requestOrigin);
      return;
    }

    try {
      if (await handleAdminRequest(request, response, url, env, database)) return;

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'ok' }, requestOrigin);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/clan') {
        const data = await getClanData(database);
        if (!data) {
          sendJson(response, 404, { error: 'Clan data has not been seeded' }, requestOrigin);
          return;
        }
        sendJson(response, 200, data, requestOrigin);
        return;
      }

      sendJson(response, 404, errorPayload('NOT_FOUND', 'Not found'), requestOrigin);
    } catch (error) {
      const status = error?.status ?? 503;
      const code =
        error?.code ?? (status === 422 ? 'VALIDATION_ERROR' : 'SERVICE_UNAVAILABLE');
      const message = status >= 500
        ? 'The clan service is temporarily unavailable'
        : error.message;
      if (status >= 500) console.error('Clan API request failed', error);
      sendJson(response, status, errorPayload(code, message, error?.details), requestOrigin);
    }
  };
}

export const server = createServer(createApiHandler());

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Clan API listening on port ${port}`);
  });
}
