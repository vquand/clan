import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ClanApiError,
  fetchClanData,
  getClanApiEndpoint,
  loginGuest,
} from '../lib/clan-api.ts';
import { buildVercelConfig } from '../lib/vercel-config.mjs';
import { getClanDisplayName } from '../lib/site-config.ts';

void test('reads and trims the optional clan display name', () => {
  assert.equal(
    getClanDisplayName({ CLAN_DISPLAY_NAME: '  Đỗ Văn  ' }),
    'Đỗ Văn',
  );
  assert.equal(getClanDisplayName({ CLAN_DISPLAY_NAME: '   ' }), undefined);
});

void test('uses the same-origin API route when remote data is enabled', () => {
  assert.equal(getClanApiEndpoint(true), '/api/clan');
  assert.equal(getClanApiEndpoint(false), null);
});

void test('returns validated clan data from the API', async () => {
  const expected = {
    members: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        fullName: 'Database Member',
        gender: 'other',
        clanRelation: 'lineage',
        generation: 0,
        parentIds: [],
        spouseIds: [],
      },
    ],
    events: [],
  };

  const data = await fetchClanData('/api/clan', async () =>
    Response.json(expected),
  );

  assert.deepEqual(data, expected);
});

void test('rejects API errors instead of substituting sample records', async () => {
  await assert.rejects(
    () =>
      fetchClanData(
        '/api/clan',
        async () => new Response('Unavailable', { status: 503 }),
      ),
    /returned 503/i,
  );
});

void test('preserves an unauthorized status so the UI can show guest access', async () => {
  await assert.rejects(
    () =>
      fetchClanData('/api/clan', async () =>
        Response.json(
          {
            error: {
              code: 'GUEST_AUTHENTICATION_REQUIRED',
              message: 'Guest authentication is required',
            },
          },
          { status: 401 },
        ),
      ),
    (error: unknown) =>
      error instanceof ClanApiError &&
      error.status === 401 &&
      error.code === 'GUEST_AUTHENTICATION_REQUIRED',
  );
});

void test('submits only the shared password when unlocking guest access', async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const result = await loginGuest('family-password', (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    requests.push({ input, init });
    return Response.json({ authenticated: true });
  }) as typeof fetch);

  const request = requests[0];
  assert.deepEqual(result, { authenticated: true });
  assert.equal(request?.input, '/api/guest/login');
  assert.equal(request?.init?.method, 'POST');
  assert.equal(request?.init?.credentials, 'include');
  assert.equal(
    request?.init?.body,
    JSON.stringify({ password: 'family-password' }),
  );
});

void test('proxies the browser API route through the configured Vercel origin', () => {
  const config = buildVercelConfig('https://clan-be.onrender.com/');

  assert.deepEqual(config.rewrites, [
    {
      source: '/api/:path*',
      destination: 'https://clan-be.onrender.com/api/:path*',
    },
  ]);
});

void test('rejects an insecure Vercel API origin', () => {
  assert.throws(
    () => buildVercelConfig('http://clan-be.onrender.com'),
    /https/i,
  );
});
