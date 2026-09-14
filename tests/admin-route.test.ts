import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createApiHandler } from '../server/index.mjs';

async function withServer(
  callback: (baseUrl: string) => Promise<unknown>,
  envOverrides: Record<string, string> = {},
) {
  const server = createServer(
    createApiHandler({
      database: null,
      env: {
        NODE_ENV: 'test',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'secret-password',
        ADMIN_SESSION_SECRET: 'test-session-secret',
        GUEST_PASSWORD: 'family-password',
        ...envOverrides,
      },
    }),
  );
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

void test('protects the admin data endpoint and manages an authenticated session', async () => {
  await withServer(async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/api/admin/data`);
    assert.equal(unauthenticated.status, 401);

    const invalidLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    assert.equal(invalidLogin.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret-password' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie ?? '', /clan_admin_session=/);

    const session = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { cookie: cookie?.split(';', 1)[0] ?? '' },
    });
    assert.deepEqual(await session.json(), { authenticated: true });

    const logout = await fetch(`${baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { cookie: cookie?.split(';', 1)[0] ?? '' },
    });
    assert.equal(logout.status, 200);
  });
});

void test('serves the fictional demo database when no database URL is configured', async () => {
  await withServer(async (baseUrl) => {
    const locked = await fetch(`${baseUrl}/api/clan`);
    assert.equal(locked.status, 401);

    const invalidGuestLogin = await fetch(`${baseUrl}/api/guest/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    assert.equal(invalidGuestLogin.status, 401);

    const guestLogin = await fetch(`${baseUrl}/api/guest/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ password: 'family-password' }),
    });
    assert.equal(guestLogin.status, 200);
    const guestCookie = guestLogin.headers.get('set-cookie');
    assert.match(guestCookie ?? '', /clan_guest_session=/);
    assert.match(guestCookie ?? '', /HttpOnly/i);
    assert.match(guestCookie ?? '', /SameSite=Lax/i);
    assert.match(guestCookie ?? '', /Secure/i);

    const response = await fetch(`${baseUrl}/api/clan`, {
      headers: { cookie: guestCookie?.split(';', 1)[0] ?? '' },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.members[0].fullName, 'Nguyễn Văn An');
    assert.equal(data.members.length, 10);
    assert.equal(data.events.length, 3);
    assert.equal(data.locations.length, 2);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret-password' }),
    });
    const cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    const adminData = await fetch(`${baseUrl}/api/admin/data`, {
      headers: { cookie },
    });
    assert.equal(adminData.status, 200);
    assert.equal((await adminData.json()).members.length, 10);

    const adminRead = await fetch(`${baseUrl}/api/clan`, {
      headers: { cookie },
    });
    assert.equal(adminRead.status, 200);
  });
});

void test('fails closed when guest access is not configured', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/clan`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: {
          code: 'GUEST_ACCESS_NOT_CONFIGURED',
          message: 'The clan service is temporarily unavailable',
        },
      });
    },
    { GUEST_PASSWORD: '' },
  );
});

void test('rate limits repeated guest password failures', async () => {
  await withServer(async (baseUrl) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/guest/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      });
      assert.equal(response.status, 401);
    }

    const blocked = await fetch(`${baseUrl}/api/guest/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'family-password' }),
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '900');
  });
});
