import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createApiHandler } from '../server/index.mjs';

async function withServer(callback: (baseUrl: string) => Promise<unknown>) {
  const server = createServer(
    createApiHandler({
      database: null,
      env: {
        NODE_ENV: 'test',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'secret-password',
        ADMIN_SESSION_SECRET: 'test-session-secret',
      },
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
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
