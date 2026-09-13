import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchClanData, getClanApiEndpoint } from '../lib/clan-api.ts';
import { buildVercelConfig } from '../lib/vercel-config.mjs';

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
