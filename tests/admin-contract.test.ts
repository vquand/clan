import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionToken,
  verifySessionToken,
} from '../server/admin-auth.mjs';
import {
  normalizeEventInput,
  normalizeMemberInput,
  validateParentGraph,
} from '../server/admin-validation.mjs';

void test('creates and verifies an expiring admin session token', () => {
  const token = createSessionToken('admin', 'test-secret', 1_000);

  assert.equal(verifySessionToken(token, 'test-secret', 1_001), 'admin');
  assert.equal(verifySessionToken(token, 'wrong-secret', 1_001), null);
  assert.equal(
    verifySessionToken(token, 'test-secret', 1_000 + 60 * 60 * 9),
    null,
  );
});

void test('normalizes a member with editable relationship and avatar fields', () => {
  assert.deepEqual(
    normalizeMemberInput({
      fullName: '  Nguyễn An  ',
      gender: 'male',
      clanRelation: 'lineage',
      parentIds: ['parent-1', 'parent-1'],
      spouseIds: ['spouse-1'],
      birthYear: '1980',
      avatarStyle: 'style-2',
      avatarImageUrl: ' /portraits/an.jpg ',
    }),
    {
      full_name: 'Nguyễn An',
      familiar_name: null,
      gender: 'male',
      clan_relation: 'lineage',
      birth_year: 1980,
      birth_date: null,
      life_status: null,
      death_year: null,
      death_date: null,
      age_at_death: null,
      age_at_death_qualifier: null,
      age_group: null,
      avatar_style: 'style-2',
      avatar_image_url: '/portraits/an.jpg',
      death_anniversary_lunar_day: null,
      death_anniversary_lunar_month: null,
      hometown: null,
      residence: null,
      biography: null,
      parentIds: ['parent-1'],
      spouseIds: ['spouse-1'],
    },
  );
});

void test('accepts a compressed base64 avatar and rejects oversized image data', () => {
  const avatarDataUrl = 'data:image/webp;base64,AAAA';
  assert.equal(
    normalizeMemberInput({
      fullName: 'Compressed portrait',
      gender: 'female',
      clanRelation: 'lineage',
      avatarImageUrl: avatarDataUrl,
    }).avatar_image_url,
    avatarDataUrl,
  );

  assert.throws(
    () =>
      normalizeMemberInput({
        fullName: 'Oversized portrait',
        gender: 'female',
        clanRelation: 'lineage',
        avatarImageUrl: `data:image/webp;base64,${'A'.repeat(24_000)}`,
      }),
    /avatarImageUrl is too large/i,
  );
});

void test('rejects self relationships and mismatched recorded death ages', () => {
  assert.throws(
    () =>
      normalizeMemberInput(
        {
          fullName: 'Self',
          gender: 'other',
          clanRelation: 'lineage',
          parentIds: ['member-1'],
        },
        { memberId: 'member-1' },
      ),
    /cannot relate to itself/i,
  );

  assert.throws(
    () =>
      normalizeMemberInput({
        fullName: 'Incomplete age',
        gender: 'other',
        clanRelation: 'lineage',
        ageAtDeath: 80,
      }),
    /ageAtDeathQualifier/i,
  );
});

void test('allows an event to have no related members and normalizes yearly dates', () => {
  assert.deepEqual(
    normalizeEventInput({
      title: '  Family day ',
      type: 'gathering',
      calendar: 'lunar',
      day: '15',
      month: '8',
      recurrence: 'annual',
      relatedMemberIds: [],
      location: 'Home',
      solarDates: { '2026': '2026-09-27' },
    }),
    {
      title: 'Family day',
      type: 'gathering',
      calendar: 'lunar',
      day: 15,
      month: 8,
      recurrence: 'annual',
      event_year: null,
      relatedMemberIds: [],
      location: 'Home',
      description: null,
      solarDates: { 2026: '2026-09-27' },
    },
  );
});

void test('rejects one-time events without a year', () => {
  assert.throws(
    () =>
      normalizeEventInput({
        title: 'One day',
        type: 'gathering',
        calendar: 'solar',
        day: 1,
        month: 1,
        recurrence: 'once',
        relatedMemberIds: [],
        location: '',
      }),
    /year/i,
  );
});

void test('detects parent cycles before relationship rows are persisted', () => {
  assert.throws(
    () =>
      validateParentGraph([
        { id: 'a', parentIds: ['b'] },
        { id: 'b', parentIds: ['a'] },
      ]),
    /parent cycle/i,
  );
});
