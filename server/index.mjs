import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';

import { neon } from '@neondatabase/serverless';

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_TTL_SECONDS,
  credentialsMatch,
  createSessionToken,
  getAdminConfig,
  getCookie,
  getGuestConfig,
  guestPasswordMatches,
  parseCookies,
  verifySessionToken,
} from './admin-auth.mjs';
import {
  normalizeEventInput,
  normalizeLocationInput,
  normalizeMemberInput,
  normalizeSiblingOrderInput,
  reindexSiblingOrders,
  validateParentGraph,
} from './admin-validation.mjs';
import { assembleClanData } from './clan-data.mjs';
import {
  createClanHeadChangeEvent,
  resolveClanHeadChange,
} from './clan-head.mjs';

for (const envFile of ['.env', 'server/.env']) {
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

const port = Number(process.env.PORT ?? 10000);
const databaseUrl = process.env.DATABASE_URL?.trim();
const sql = databaseUrl ? neon(databaseUrl) : null;
const demoDatabasePath = resolve(process.cwd(), 'data/db.json');
let demoClanData;
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
    headers['access-control-allow-methods'] =
      'GET, POST, PATCH, DELETE, OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type';
    if (corsOrigin !== '*')
      headers['access-control-allow-credentials'] = 'true';
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

export async function getClanData(database = sql) {
  if (!database) return loadDemoClanData();

  const [
    memberRows,
    parentRows,
    spouseRows,
    eventRows,
    eventMemberRows,
    eventSolarDateRows,
    locationRows,
  ] = await Promise.all([
    database`
        SELECT
          id, full_name, familiar_name, gender, clan_relation, birth_year, birth_date,
          sibling_order,
          life_status, death_year, death_date, age_at_death, age_at_death_qualifier,
          age_group, avatar_style, avatar_image_url,
          is_clan_head, is_previous_clan_head,
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
          event_year, location, location_id, location_address,
          location_google_map_url, description
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
    database`
        SELECT id, name, address, google_map_url
        FROM clan_locations
        ORDER BY name, id
      `,
  ]);

  const data = assembleClanData({
    memberRows,
    parentRows,
    spouseRows,
    eventRows,
    eventMemberRows,
    eventSolarDateRows,
    locationRows,
  });
  return isClanData(data) ? data : null;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw Object.assign(new Error('Request body is too large'), {
        status: 413,
      });
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
    throw Object.assign(new Error('Request body must be valid JSON'), {
      status: 400,
    });
  }
}

function hasAdminSession(request, env) {
  const config = getAdminConfig(env);
  if (!config) return false;
  const token = getCookie(
    parseCookies(request.headers.cookie ?? ''),
    ADMIN_SESSION_COOKIE,
  );
  return verifySessionToken(token, config.sessionSecret) === config.username;
}

function hasGuestSession(request, env) {
  const config = getGuestConfig(env);
  if (!config) return false;
  const token = getCookie(
    parseCookies(request.headers.cookie ?? ''),
    GUEST_SESSION_COOKIE,
  );
  return verifySessionToken(token, config.sessionSecret) === 'guest';
}

function requestAdmin(request, env) {
  if (!getAdminConfig(env)) {
    throw Object.assign(new Error('Admin credentials are not configured'), {
      status: 503,
      code: 'ADMIN_NOT_CONFIGURED',
    });
  }
  if (!hasAdminSession(request, env)) {
    throw Object.assign(new Error('Admin authentication is required'), {
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  }
}

function requestClanReader(request, env) {
  if (!getGuestConfig(env)) {
    throw Object.assign(new Error('Guest access is not configured'), {
      status: 503,
      code: 'GUEST_ACCESS_NOT_CONFIGURED',
    });
  }
  if (!hasGuestSession(request, env) && !hasAdminSession(request, env)) {
    throw Object.assign(new Error('Guest authentication is required'), {
      status: 401,
      code: 'GUEST_AUTHENTICATION_REQUIRED',
    });
  }
}

function uuid(value, field) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
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

function siblingGroup(members, memberId, parentIds) {
  const parentIdSet = new Set(parentIds);
  return members.filter(
    (member) =>
      member.id === memberId ||
      member.parentIds.some((parentId) => parentIdSet.has(parentId)),
  );
}

function eventAsInput(event) {
  return { ...event, year: event.year };
}

function todayInClanTimeZone() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function clanHeadChangeEventQueries(database, { oldHead, newHead }) {
  const date = todayInClanTimeZone();
  const eventId = randomUUID();
  const event = createClanHeadChangeEvent({ oldHead, newHead, date });
  return [
    database`
      INSERT INTO events (
        id, title, type, calendar, day, month, recurrence, event_year,
        location, description
      ) VALUES (
        ${eventId}::uuid, ${event.title}, ${event.type}, ${event.calendar},
        ${event.day}, ${event.month}, ${event.recurrence}, ${event.event_year},
        ${event.location}, ${event.description}
      )
    `,
    ...event.relatedMemberIds.map(
      (memberId) => database`
        INSERT INTO event_members (event_id, member_id)
        VALUES (${eventId}::uuid, ${memberId}::uuid)
      `,
    ),
  ];
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
        sibling_order,
        life_status, death_year, death_date, age_at_death, age_at_death_qualifier,
        age_group, avatar_style, avatar_image_url,
        is_clan_head, is_previous_clan_head,
        death_anniversary_lunar_day, death_anniversary_lunar_month,
        hometown, residence, biography
      ) VALUES (
        ${id}::uuid, ${input.full_name}, ${input.familiar_name}, ${input.gender},
        ${input.clan_relation}, ${input.birth_year}, ${input.birth_date},
        ${input.sibling_order},
        ${input.life_status}, ${input.death_year}, ${input.death_date},
        ${input.age_at_death}, ${input.age_at_death_qualifier}, ${input.age_group},
        ${input.avatar_style}, ${input.avatar_image_url},
        ${input.is_clan_head}, ${input.is_previous_clan_head},
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
  const id = randomUUID();
  const currentHead = data.members.find((member) => member.isClanHead);
  const headChange = resolveClanHeadChange({
    currentMember: null,
    currentHead,
    requestedMember: {
      id,
      fullName: input.full_name,
      status: input.life_status,
      isClanHead: input.is_clan_head,
      isPreviousClanHead: input.is_previous_clan_head,
    },
    confirmHeadChange: body.confirmClanHeadChange === true,
  });
  const nextInput = {
    ...input,
    is_clan_head: headChange.isClanHead,
    is_previous_clan_head: headChange.isPreviousClanHead,
  };
  await assertMemberRelationships(
    database,
    data,
    'new-member',
    nextInput.parentIds,
  );
  await assertMemberIds(database, nextInput.spouseIds);
  const queries = [
    ...(headChange.previousHeadId
      ? [
          database`
            UPDATE members
            SET is_clan_head = FALSE, is_previous_clan_head = TRUE, updated_at = NOW()
            WHERE id = ${headChange.previousHeadId}::uuid
          `,
        ]
      : []),
    ...memberQueries(database, id, nextInput),
    ...(headChange.headChanged
      ? clanHeadChangeEventQueries(database, {
          oldHead: currentHead,
          newHead: headChange.newHeadId
            ? { id, fullName: input.full_name }
            : null,
        })
      : []),
  ];
  await database.transaction(queries);
  return (await getClanData(database)).members.find(
    (member) => member.id === id,
  );
}

async function updateMember(database, id, body) {
  uuid(id, 'Member ID');
  const data = await getClanData(database);
  const current = data.members.find((member) => member.id === id);
  if (!current) {
    throw Object.assign(new Error('Member not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
  const input = normalizeAdminInput(
    normalizeMemberInput,
    { ...memberAsInput(current), ...body },
    { memberId: id },
  );
  const currentHead = data.members.find((member) => member.isClanHead);
  const headChange = resolveClanHeadChange({
    currentMember: current,
    currentHead,
    requestedMember: {
      id,
      fullName: input.full_name,
      status: input.life_status,
      isClanHead: input.is_clan_head,
      isPreviousClanHead: input.is_previous_clan_head,
    },
    confirmHeadChange: body.confirmClanHeadChange === true,
  });
  const nextInput = {
    ...input,
    is_clan_head: headChange.isClanHead,
    is_previous_clan_head: headChange.isPreviousClanHead,
  };
  await assertMemberRelationships(database, data, id, nextInput.parentIds);
  await assertMemberIds(database, nextInput.spouseIds);

  let siblingOrderUpdates = [];
  if (
    Object.prototype.hasOwnProperty.call(body, 'siblingOrder') &&
    nextInput.sibling_order !== null &&
    nextInput.parentIds.length > 0
  ) {
    const membersWithNextParents = data.members.map((member) =>
      member.id === id ? { ...member, parentIds: nextInput.parentIds } : member,
    );
    const siblings = siblingGroup(
      membersWithNextParents,
      id,
      nextInput.parentIds,
    );
    if (siblings.length > 1) {
      let reindexedSiblings;
      try {
        reindexedSiblings = reindexSiblingOrders(
          siblings,
          id,
          nextInput.sibling_order,
        );
      } catch (error) {
        throw Object.assign(new Error(error.message), {
          status: 422,
          code: 'VALIDATION_ERROR',
        });
      }
      siblingOrderUpdates = reindexedSiblings.map(
        ({ id: siblingId, siblingOrder }) => database`
          UPDATE members
          SET sibling_order = ${siblingOrder}, updated_at = NOW()
          WHERE id = ${siblingId}::uuid
        `,
      );
    }
  }

  const queries = [
    ...(headChange.previousHeadId && headChange.previousHeadId !== id
      ? [
          database`
            UPDATE members
            SET is_clan_head = FALSE, is_previous_clan_head = TRUE, updated_at = NOW()
            WHERE id = ${headChange.previousHeadId}::uuid
          `,
        ]
      : []),
    database`
      UPDATE members
      SET full_name = ${input.full_name}, familiar_name = ${input.familiar_name},
          gender = ${input.gender}, clan_relation = ${input.clan_relation},
          birth_year = ${input.birth_year}, birth_date = ${input.birth_date},
          sibling_order = ${input.sibling_order},
          life_status = ${input.life_status}, death_year = ${input.death_year},
          death_date = ${input.death_date}, age_at_death = ${input.age_at_death},
          age_at_death_qualifier = ${input.age_at_death_qualifier},
          age_group = ${input.age_group}, avatar_style = ${input.avatar_style},
          avatar_image_url = ${input.avatar_image_url},
          is_clan_head = ${nextInput.is_clan_head},
          is_previous_clan_head = ${nextInput.is_previous_clan_head},
          death_anniversary_lunar_day = ${input.death_anniversary_lunar_day},
          death_anniversary_lunar_month = ${input.death_anniversary_lunar_month},
          hometown = ${input.hometown}, residence = ${input.residence},
          biography = ${input.biography}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `,
    database`DELETE FROM member_parents WHERE child_id = ${id}::uuid`,
    database`DELETE FROM member_spouses WHERE member_a_id = ${id}::uuid OR member_b_id = ${id}::uuid`,
    ...siblingOrderUpdates,
    ...nextInput.parentIds.map(
      (parentId, index) => database`
        INSERT INTO member_parents (child_id, parent_id, parent_order)
        VALUES (${id}::uuid, ${parentId}::uuid, ${index + 1})
      `,
    ),
    ...nextInput.spouseIds.map(
      (spouseId) => database`
        INSERT INTO member_spouses (member_a_id, member_b_id)
        VALUES (LEAST(${id}::uuid, ${spouseId}::uuid), GREATEST(${id}::uuid, ${spouseId}::uuid))
        ON CONFLICT DO NOTHING
      `,
    ),
    ...(headChange.headChanged
      ? clanHeadChangeEventQueries(database, {
          oldHead: currentHead,
          newHead: headChange.newHeadId
            ? { id, fullName: input.full_name }
            : null,
        })
      : []),
  ];
  await database.transaction(queries);
  return (await getClanData(database)).members.find(
    (member) => member.id === id,
  );
}

async function reorderSiblings(database, body) {
  const input = normalizeAdminInput(normalizeSiblingOrderInput, body);
  const memberIds = input.memberIds.map((memberId) =>
    uuid(memberId, 'Member ID'),
  );
  const data = await getClanData(database);
  const membersById = new Map(
    data.members.map((member) => [member.id, member]),
  );
  const anchor = membersById.get(memberIds[0]);

  if (!anchor || anchor.parentIds.length === 0) {
    throw Object.assign(
      new Error('Sibling order requires members with a shared parent'),
      {
        status: 422,
        code: 'INVALID_RELATIONSHIP',
      },
    );
  }

  const expectedSiblingIds = siblingGroup(
    data.members,
    anchor.id,
    anchor.parentIds,
  ).map((member) => member.id);
  const requestedIds = new Set(memberIds);
  if (
    expectedSiblingIds.length !== memberIds.length ||
    expectedSiblingIds.some((memberId) => !requestedIds.has(memberId))
  ) {
    throw Object.assign(
      new Error('The sibling order must include every sibling in the group'),
      {
        status: 422,
        code: 'INVALID_RELATIONSHIP',
      },
    );
  }

  await database.transaction(
    memberIds.map(
      (memberId, index) => database`
        UPDATE members
        SET sibling_order = ${index + 1}, updated_at = NOW()
        WHERE id = ${memberId}::uuid
      `,
    ),
  );

  return (await getClanData(database)).members.filter((member) =>
    requestedIds.has(member.id),
  );
}

async function deleteMember(database, id) {
  uuid(id, 'Member ID');
  const result =
    await database`DELETE FROM members WHERE id = ${id}::uuid RETURNING id`;
  if (result.length === 0) {
    throw Object.assign(new Error('Member not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
}

async function resolveEventLocation(database, input) {
  if (input.location_id) {
    const locationId = uuid(input.location_id, 'Location ID');
    const rows = await database`
      SELECT id, name, address, google_map_url
      FROM clan_locations
      WHERE id = ${locationId}::uuid
    `;
    if (rows.length === 0) {
      throw Object.assign(new Error('Location not found'), {
        status: 422,
        code: 'INVALID_LOCATION',
      });
    }
    const row = rows[0];
    return {
      id: String(row.id),
      name: row.name,
      address: row.address ?? '',
      googleMapUrl: row.google_map_url ?? null,
      save: false,
    };
  }

  const location = {
    id: null,
    name: input.location_name ?? input.location ?? '',
    address: input.location_address ?? '',
    googleMapUrl: input.location_google_map_url ?? null,
    save: input.save_location,
  };
  if (location.save) {
    const rows = await database`
      INSERT INTO clan_locations (id, name, address, google_map_url)
      VALUES (${randomUUID()}::uuid, ${location.name}, ${location.address}, ${location.googleMapUrl})
      ON CONFLICT (name) DO UPDATE
      SET address = EXCLUDED.address,
          google_map_url = EXCLUDED.google_map_url,
          updated_at = NOW()
      RETURNING id
    `;
    location.id = String(rows[0].id);
    location.save = false;
  }
  return location;
}

function insertEventQuery(database, id, input, location) {
  return database`
    INSERT INTO events (
      id, title, type, calendar, day, month, recurrence, event_year,
      location, location_id, location_address, location_google_map_url,
      description
    ) VALUES (
      ${id}::uuid, ${input.title}, ${input.type}, ${input.calendar}, ${input.day},
      ${input.month}, ${input.recurrence}, ${input.event_year},
      ${location.name}, ${location.id}::uuid,
      ${location.address}, ${location.googleMapUrl}, ${input.description}
    )
  `;
}

function eventQueries(database, id, input, location) {
  return [
    insertEventQuery(database, id, input, location),
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

async function createLocation(database, body) {
  const input = normalizeAdminInput(normalizeLocationInput, body);
  const id = randomUUID();
  await database.transaction([
    database`
      INSERT INTO clan_locations (id, name, address, google_map_url)
      VALUES (${id}::uuid, ${input.name}, ${input.address}, ${input.google_map_url})
    `,
  ]);
  return (await getClanData(database)).locations?.find(
    (location) => location.id === id,
  );
}

async function updateLocation(database, id, body) {
  uuid(id, 'Location ID');
  const input = normalizeAdminInput(normalizeLocationInput, body);
  const result = await database`
    UPDATE clan_locations
    SET name = ${input.name}, address = ${input.address},
        google_map_url = ${input.google_map_url}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id
  `;
  if (result.length === 0) {
    throw Object.assign(new Error('Location not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
  return (await getClanData(database)).locations?.find(
    (location) => location.id === id,
  );
}

async function deleteLocation(database, id) {
  uuid(id, 'Location ID');
  const result = await database`
    DELETE FROM clan_locations
    WHERE id = ${id}::uuid
    RETURNING id
  `;
  if (result.length === 0) {
    throw Object.assign(new Error('Location not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
}

async function createEvent(database, body) {
  const input = normalizeAdminInput(normalizeEventInput, body);
  const id = randomUUID();
  await assertMemberIds(database, input.relatedMemberIds);
  const location = await resolveEventLocation(database, input);
  await database.transaction(eventQueries(database, id, input, location));
  return (await getClanData(database)).events.find((event) => event.id === id);
}

async function updateEvent(database, id, body) {
  uuid(id, 'Event ID');
  const data = await getClanData(database);
  const current = data.events.find((event) => event.id === id);
  if (!current) {
    throw Object.assign(new Error('Event not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
  const input = normalizeAdminInput(normalizeEventInput, {
    ...eventAsInput(current),
    ...body,
  });
  await assertMemberIds(database, input.relatedMemberIds);
  const location = await resolveEventLocation(database, input);
  const queries = [
    database`
      UPDATE events
      SET title = ${input.title}, type = ${input.type}, calendar = ${input.calendar},
          day = ${input.day}, month = ${input.month}, recurrence = ${input.recurrence},
          event_year = ${input.event_year}, location = ${location.name},
          location_id = ${location.id ? location.id : null}::uuid,
          location_address = ${location.address},
          location_google_map_url = ${location.googleMapUrl},
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
  const result =
    await database`DELETE FROM events WHERE id = ${id}::uuid RETURNING id`;
  if (result.length === 0) {
    throw Object.assign(new Error('Event not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
}

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1_000;

function createLoginLimiter(now = Date.now) {
  const failures = new Map();

  function getKey(request, scope) {
    return `${scope}:${request.socket.remoteAddress ?? 'unknown'}`;
  }

  return {
    retryAfter(request, scope) {
      const key = getKey(request, scope);
      const entry = failures.get(key);
      if (!entry) return 0;
      const remainingMs = entry.expiresAt - now();
      if (remainingMs <= 0) {
        failures.delete(key);
        return 0;
      }
      return entry.count >= LOGIN_ATTEMPT_LIMIT
        ? Math.ceil(remainingMs / 1_000)
        : 0;
    },
    recordFailure(request, scope) {
      const key = getKey(request, scope);
      const current = failures.get(key);
      if (!current || current.expiresAt <= now()) {
        failures.set(key, {
          count: 1,
          expiresAt: now() + LOGIN_ATTEMPT_WINDOW_MS,
        });
        return;
      }
      current.count += 1;
    },
    clear(request, scope) {
      failures.delete(getKey(request, scope));
    },
  };
}

function secureRequest(request, env) {
  const forwardedProtocol = Array.isArray(request.headers['x-forwarded-proto'])
    ? request.headers['x-forwarded-proto'][0]
    : request.headers['x-forwarded-proto']?.split(',')[0]?.trim();
  return env.NODE_ENV === 'production' || forwardedProtocol === 'https';
}

function cookieHeader(name, token, maxAge, secure) {
  return [
    `${name}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

function sendLoginRateLimit(response, requestOrigin, retryAfter) {
  sendJson(
    response,
    429,
    errorPayload(
      'TOO_MANY_LOGIN_ATTEMPTS',
      'Too many login attempts; try again later',
    ),
    requestOrigin,
    { 'retry-after': String(retryAfter) },
  );
}

async function handleGuestRequest(request, response, url, env, loginLimiter) {
  if (url.pathname === '/api/guest/login' && request.method === 'POST') {
    const config = getGuestConfig(env);
    if (!config) {
      sendJson(
        response,
        503,
        errorPayload(
          'GUEST_ACCESS_NOT_CONFIGURED',
          'Guest access is not configured',
        ),
        request.headers.origin,
      );
      return true;
    }
    const retryAfter = loginLimiter.retryAfter(request, 'guest');
    if (retryAfter > 0) {
      sendLoginRateLimit(response, request.headers.origin, retryAfter);
      return true;
    }
    const body = await readJsonBody(request);
    if (!guestPasswordMatches(body.password, config)) {
      loginLimiter.recordFailure(request, 'guest');
      sendJson(
        response,
        401,
        errorPayload('INVALID_GUEST_PASSWORD', 'Invalid guest password'),
        request.headers.origin,
      );
      return true;
    }
    loginLimiter.clear(request, 'guest');
    const token = createSessionToken('guest', config.sessionSecret, {
      ttlSeconds: GUEST_SESSION_TTL_SECONDS,
    });
    sendJson(response, 200, { authenticated: true }, request.headers.origin, {
      'set-cookie': cookieHeader(
        GUEST_SESSION_COOKIE,
        token,
        GUEST_SESSION_TTL_SECONDS,
        secureRequest(request, env),
      ),
    });
    return true;
  }

  return false;
}

async function handleAdminRequest(
  request,
  response,
  url,
  env,
  database,
  loginLimiter,
) {
  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    const config = getAdminConfig(env);
    const token = getCookie(
      parseCookies(request.headers.cookie ?? ''),
      ADMIN_SESSION_COOKIE,
    );
    const authenticated = Boolean(
      config &&
      verifySessionToken(token, config.sessionSecret) === config.username,
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
        errorPayload(
          'ADMIN_NOT_CONFIGURED',
          'Admin credentials are not configured',
        ),
        request.headers.origin,
      );
      return true;
    }
    const retryAfter = loginLimiter.retryAfter(request, 'admin');
    if (retryAfter > 0) {
      sendLoginRateLimit(response, request.headers.origin, retryAfter);
      return true;
    }
    const body = await readJsonBody(request);
    if (!credentialsMatch(body.username, body.password, config)) {
      loginLimiter.recordFailure(request, 'admin');
      sendJson(
        response,
        401,
        errorPayload(
          'INVALID_CREDENTIALS',
          'Invalid admin username or password',
        ),
        request.headers.origin,
      );
      return true;
    }
    loginLimiter.clear(request, 'admin');
    const token = createSessionToken(config.username, config.sessionSecret);
    sendJson(response, 200, { authenticated: true }, request.headers.origin, {
      'set-cookie': cookieHeader(
        ADMIN_SESSION_COOKIE,
        token,
        ADMIN_SESSION_TTL_SECONDS,
        secureRequest(request, env),
      ),
    });
    return true;
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    sendJson(response, 200, { authenticated: false }, request.headers.origin, {
      'set-cookie': cookieHeader(
        ADMIN_SESSION_COOKIE,
        '',
        0,
        secureRequest(request, env),
      ),
    });
    return true;
  }

  if (!url.pathname.startsWith('/api/admin/')) return false;
  requestAdmin(request, env);

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

  if (!database) {
    throw Object.assign(
      new Error(
        'The demo database is read-only; configure DATABASE_URL to enable admin writes',
      ),
      { status: 503, code: 'DEMO_DATABASE_READ_ONLY' },
    );
  }

  if (
    url.pathname === '/api/admin/siblings/reorder' &&
    request.method === 'POST'
  ) {
    const members = await reorderSiblings(
      database,
      await readJsonBody(request),
    );
    sendJson(response, 200, members, request.headers.origin);
    return true;
  }

  const locationMatch = url.pathname.match(
    /^\/api\/admin\/locations(?:\/([^/]+))?$/,
  );
  if (locationMatch) {
    const id = locationMatch[1] ? decodeURIComponent(locationMatch[1]) : null;
    if (request.method === 'POST' && !id) {
      const location = await createLocation(
        database,
        await readJsonBody(request),
      );
      sendJson(response, 201, location, request.headers.origin);
      return true;
    }
    if (request.method === 'PATCH' && id) {
      const location = await updateLocation(
        database,
        id,
        await readJsonBody(request),
      );
      sendJson(response, 200, location, request.headers.origin);
      return true;
    }
    if (request.method === 'DELETE' && id) {
      await deleteLocation(database, id);
      sendJson(response, 200, { deleted: true }, request.headers.origin);
      return true;
    }
  }

  const memberMatch = url.pathname.match(
    /^\/api\/admin\/members(?:\/([^/]+))?$/,
  );
  if (memberMatch) {
    const id = memberMatch[1] ? decodeURIComponent(memberMatch[1]) : null;
    if (request.method === 'POST' && !id) {
      const member = await createMember(database, await readJsonBody(request));
      sendJson(response, 201, member, request.headers.origin);
      return true;
    }
    if (request.method === 'PATCH' && id) {
      const member = await updateMember(
        database,
        id,
        await readJsonBody(request),
      );
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
      const event = await updateEvent(
        database,
        id,
        await readJsonBody(request),
      );
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
  const loginLimiter = createLoginLimiter();
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
      if (await handleGuestRequest(request, response, url, env, loginLimiter))
        return;
      if (
        await handleAdminRequest(
          request,
          response,
          url,
          env,
          database,
          loginLimiter,
        )
      )
        return;

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'ok' }, requestOrigin);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/clan') {
        requestClanReader(request, env);
        const data = await getClanData(database);
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
        return;
      }

      sendJson(
        response,
        404,
        errorPayload('NOT_FOUND', 'Not found'),
        requestOrigin,
      );
    } catch (error) {
      const status = error?.status ?? 503;
      const code =
        error?.code ??
        (status === 422 ? 'VALIDATION_ERROR' : 'SERVICE_UNAVAILABLE');
      const message =
        status >= 500
          ? 'The clan service is temporarily unavailable'
          : error.message;
      if (status >= 500) console.error('Clan API request failed', error);
      sendJson(
        response,
        status,
        errorPayload(code, message, error?.details),
        requestOrigin,
      );
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
