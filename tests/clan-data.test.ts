import assert from 'node:assert/strict';
import test from 'node:test';

import { clanEvents } from '../data/events.ts';
import { members } from '../data/members.ts';
import { resolveClanData } from '../lib/clan-data.ts';

void test('uses the public sample dataset when no private dataset is configured', () => {
  assert.deepEqual(resolveClanData(), { members, events: clanEvents });
});

void test('accepts a valid clan dataset supplied at build time', () => {
  const privateData = {
    members: [
      {
        id: 'founder',
        fullName: 'Private Example',
        gender: 'other',
        generation: 1,
        branch: 'Main branch',
        parentIds: [],
        spouseIds: [],
      },
    ],
    events: [],
  };

  assert.deepEqual(resolveClanData(JSON.stringify(privateData)), privateData);
});

void test('rejects malformed build-time clan data', () => {
  assert.throws(
    () => resolveClanData('{"members":"not-an-array","events":[]}'),
    /members.*array/i,
  );
});
