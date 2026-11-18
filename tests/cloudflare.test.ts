import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import test from 'node:test';
import worker from '../server/worker.mjs';
import { createD1Database, createD1LoginLimiter } from '../server/d1.mjs';
import {
  assertSameTable,
  buildD1Import,
  CLAN_TABLES,
  seedSnapshot,
} from '../scripts/d1-data.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(
    readFileSync(
      new URL('../db/d1-migrations/0001_baseline.sql', import.meta.url),
      'utf8',
    ),
  );
  const binding = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...input: SQLInputValue[]) {
          values = input;
          return this;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...values) };
        },
        async first() {
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async run() {
          return sqlite.prepare(sql).run(...values);
        },
      };
    },
    async batch(statements: Array<{ all: () => Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, binding };
}

void test('D1 queries stay lazy and a failed batch rolls back all writes', async (t) => {
  const { sqlite, binding } = database();
  t.after(() => sqlite.close());
  const sql = createD1Database(binding);
  const insert = sql`INSERT INTO clan_locations (id, name) VALUES (${'home'}, ${'Home'})`;
  assert.equal(
    sqlite.prepare('SELECT count(*) AS count FROM clan_locations').get()?.count,
    0,
  );
  await assert.rejects(
    () =>
      sql.transaction([
        insert,
        sql`INSERT INTO clan_locations (id, name) VALUES (${'other'}, ${'Home'})`,
      ]),
    /UNIQUE/,
  );
  assert.equal(
    sqlite.prepare('SELECT count(*) AS count FROM clan_locations').get()?.count,
    0,
  );
});

void test('Worker protects data, keeps cookie security, and supports relational admin CRUD', async (t) => {
  const { sqlite, binding } = database();
  t.after(() => sqlite.close());
  const env = {
    DB: binding,
    GUEST_PASSWORD: 'family-password',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin-password',
    ADMIN_SESSION_SECRET: 'test-secret',
    ASSETS: { fetch: async () => new Response('static shell') },
  };
  const request = (path: string, method = 'GET', body?: unknown, cookie = '') =>
    worker.fetch(
      new Request(`https://clan.example${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          cookie,
          'cf-connecting-ip': '192.0.2.1',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    );
  assert.equal(await (await request('/')).text(), 'static shell');
  assert.equal((await request('/api/clan')).status, 401);
  const login = await request('/api/admin/login', 'POST', {
    username: 'admin',
    password: 'admin-password',
  });
  assert.equal(login.status, 200);
  assert.match(
    login.headers.get('set-cookie') ?? '',
    /HttpOnly; SameSite=Lax; Max-Age=28800; Secure/,
  );
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const createMember = async (fullName: string, extra = {}) => {
    const response = await request(
      '/api/admin/members',
      'POST',
      {
        fullName,
        gender: 'male',
        clanRelation: 'lineage',
        parentIds: [],
        spouseIds: [],
        ...extra,
      },
      cookie,
    );
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  const father = await createMember('Founder', {
    isClanHead: true,
    status: 'living',
    avatarImageUrl: 'data:image/png;base64,YQ==',
  });
  assert.equal(father.isClanHead, true);
  const child = await createMember('Child', { parentIds: [father.id] });
  const sibling = await createMember('Sibling', {
    parentIds: [father.id],
    spouseIds: [child.id],
  });
  const reorder = await request(
    '/api/admin/siblings/reorder',
    'POST',
    { memberIds: [sibling.id, child.id] },
    cookie,
  );
  assert.equal(reorder.status, 200);
  const promotion = await request(
    `/api/admin/members/${child.id}`,
    'PATCH',
    {
      isClanHead: true,
      confirmClanHeadChange: true,
      status: 'living',
    },
    cookie,
  );
  assert.equal(promotion.status, 200);
  assert.equal((await promotion.json()).isClanHead, true);
  const location = await request(
    '/api/admin/locations',
    'POST',
    { name: 'Home', address: 'Family address' },
    cookie,
  );
  assert.equal(location.status, 201);
  const locationId = (await location.json()).id;
  assert.equal(
    (
      await request(
        `/api/admin/locations/${locationId}`,
        'PATCH',
        { name: 'Family home' },
        cookie,
      )
    ).status,
    200,
  );
  const event = await request(
    '/api/admin/events',
    'POST',
    {
      title: 'Anniversary',
      type: 'death-anniversary',
      calendar: 'lunar',
      day: 15,
      month: 8,
      recurrence: 'annual',
      relatedMemberIds: [child.id],
      locationId,
      solarDates: { 2026: '2026-09-25' },
    },
    cookie,
  );
  assert.equal(event.status, 201, await event.clone().text());
  const eventId = (await event.json()).id;
  assert.equal(
    (
      await request(
        `/api/admin/events/${eventId}`,
        'PATCH',
        { title: 'Updated anniversary' },
        cookie,
      )
    ).status,
    200,
  );
  const data = await (
    await request('/api/clan', 'GET', undefined, cookie)
  ).json();
  assert.equal(
    data.members.find((member: { id: string }) => member.id === father.id)
      .isPreviousClanHead,
    true,
  );
  assert.equal(
    data.members.find((member: { id: string }) => member.id === child.id)
      .siblingOrder,
    2,
  );
  assert.deepEqual(
    data.members.find((member: { id: string }) => member.id === child.id)
      .spouseIds,
    [sibling.id],
  );
  assert.equal(
    data.events.find((item: { id: string }) => item.id === eventId)
      .solarDates[2026],
    '2026-09-25',
  );
  assert.equal(
    (await request(`/api/admin/events/${eventId}`, 'DELETE', undefined, cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/locations/${locationId}`,
        'DELETE',
        undefined,
        cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/members/${sibling.id}`,
        'DELETE',
        undefined,
        cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    sqlite.prepare('SELECT count(*) AS count FROM member_spouses').get()?.count,
    0,
  );
  const guest = await request('/api/guest/login', 'POST', {
    password: 'family-password',
  });
  assert.equal(guest.status, 200);
  assert.equal(
    (
      await request(
        '/api/clan',
        'GET',
        undefined,
        guest.headers.get('set-cookie')!.split(';')[0],
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/admin/logout', 'POST', {}, cookie)).status,
    200,
  );
  const tooLarge = await request(
    '/api/admin/members',
    'POST',
    { biography: 'a'.repeat(1_000_001) },
    cookie,
  );
  assert.equal(tooLarge.status, 413);
  const crossOrigin = await worker.fetch(
    new Request('https://clan.example/api/guest/login', {
      method: 'POST',
      headers: { origin: 'https://other.example' },
      body: '{}',
    }),
    env,
  );
  assert.equal(crossOrigin.status, 403);
});

void test('D1 login limits survive new limiter instances, expire, and separate IPs and scopes', async (t) => {
  const { sqlite, binding } = database();
  t.after(() => sqlite.close());
  let now = 1000;
  const request = { socket: { remoteAddress: '192.0.2.1' } };
  for (let i = 0; i < 10; i++)
    await createD1LoginLimiter(binding, () => now).recordFailure(
      request,
      'guest',
    );
  const limiter = createD1LoginLimiter(binding, () => now);
  assert.equal(await limiter.retryAfter(request, 'guest'), 900);
  assert.equal(await limiter.retryAfter(request, 'admin'), 0);
  assert.equal(
    await limiter.retryAfter(
      { socket: { remoteAddress: '192.0.2.2' } },
      'guest',
    ),
    0,
  );
  now += 900_001;
  assert.equal(await limiter.retryAfter(request, 'guest'), 0);
  await limiter.recordFailure(request, 'guest');
  assert.equal(
    sqlite.prepare('SELECT count FROM login_attempts').get()?.count,
    1,
  );
  await limiter.clear(request, 'guest');
  assert.equal(
    sqlite.prepare('SELECT count(*) AS count FROM login_attempts').get()?.count,
    0,
  );
});

void test('Neon snapshot import preserves every column, tolerates retries, and detects mismatches', (t) => {
  const { sqlite } = database();
  t.after(() => sqlite.close());
  const seed = JSON.parse(
    readFileSync(
      new URL('../examples/clan-data.example.json', import.meta.url),
      'utf8',
    ),
  );
  const snapshot = seedSnapshot(seed);
  snapshot.tables.members[0].is_clan_head = true;
  snapshot.tables.members[0].full_name = "Đỗ O'Brien; -- family";
  sqlite.exec(buildD1Import(snapshot));
  const tables = Object.fromEntries(
    Object.keys(CLAN_TABLES).map((table) => [
      table,
      sqlite.prepare(`SELECT * FROM ${table}`).all(),
    ]),
  );
  const exported = { format: 1, tables };
  sqlite.exec(buildD1Import(exported));
  for (const [table, rows] of Object.entries(tables)) {
    assertSameTable(
      table,
      rows,
      sqlite.prepare(`SELECT * FROM ${table}`).all(),
    );
  }
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.throws(
    () => assertSameTable('members', tables.members, []),
    /Verification failed/,
  );
  assert.throws(
    () => buildD1Import({ format: 1, tables: {} }),
    /missing table/,
  );
});
