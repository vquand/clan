import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionToken,
  verifySessionToken,
} from '../server/admin-auth.mjs';
import {
  normalizeLocationInput,
  normalizeEventInput,
  normalizeMemberInput,
  validateParentGraph,
} from '../server/admin-validation.mjs';
import {
  createClanHeadChangeEvent,
  resolveClanHeadChange,
} from '../server/clan-head.mjs';

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
      is_clan_head: false,
      is_previous_clan_head: false,
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

void test('promotes a replacement and records the outgoing clan head', () => {
  assert.deepEqual(
    resolveClanHeadChange({
      currentMember: {
        id: 'head-a',
        isClanHead: false,
        isPreviousClanHead: false,
        status: 'living',
      },
      currentHead: {
        id: 'head-b',
        fullName: 'Head B',
        isClanHead: true,
        isPreviousClanHead: false,
        status: 'living',
      },
      requestedMember: {
        id: 'head-a',
        status: 'living',
        isClanHead: true,
        isPreviousClanHead: false,
      },
      confirmHeadChange: true,
    }),
    {
      isClanHead: true,
      isPreviousClanHead: false,
      previousHeadId: 'head-b',
      newHeadId: 'head-a',
      headChanged: true,
    },
  );
});

void test('builds a solar event for a clan head change', () => {
  assert.deepEqual(
    createClanHeadChangeEvent({
      oldHead: { id: 'head-b', fullName: 'Head B' },
      newHead: { id: 'head-a', fullName: 'Head A' },
      date: { day: 13, month: 9, year: 2026 },
    }),
    {
      title: 'Thay đổi trưởng họ',
      type: 'clan-ceremony',
      calendar: 'solar',
      day: 13,
      month: 9,
      recurrence: 'once',
      event_year: 2026,
      location: '',
      description: 'Trưởng họ được chuyển từ Head B sang Head A.',
      relatedMemberIds: ['head-b', 'head-a'],
    },
  );
});

void test('rejects a deceased person as a new clan head', () => {
  assert.throws(
    () =>
      resolveClanHeadChange({
        currentMember: null,
        currentHead: null,
        requestedMember: {
          id: 'deceased',
          status: 'deceased',
          isClanHead: true,
          isPreviousClanHead: false,
        },
        confirmHeadChange: false,
      }),
    (error: unknown) => {
      if (!(error instanceof Error)) return false;
      return (error as Error & { status?: number }).status === 422;
    },
  );
});

void test('automatically marks a current head as previous when recorded deceased', () => {
  assert.deepEqual(
    resolveClanHeadChange({
      currentMember: {
        id: 'head-a',
        isClanHead: true,
        isPreviousClanHead: false,
        status: 'living',
      },
      currentHead: {
        id: 'head-a',
        fullName: 'Head A',
        isClanHead: true,
        isPreviousClanHead: false,
        status: 'living',
      },
      requestedMember: {
        id: 'head-a',
        status: 'deceased',
        isClanHead: true,
        isPreviousClanHead: false,
      },
      confirmHeadChange: false,
    }),
    {
      isClanHead: false,
      isPreviousClanHead: true,
      previousHeadId: 'head-a',
      newHeadId: null,
      headChanged: true,
    },
  );
});

void test('requires confirmation before replacing another current clan head', () => {
  assert.throws(
    () =>
      resolveClanHeadChange({
        currentMember: null,
        currentHead: {
          id: 'head-b',
          fullName: 'Head B',
          isClanHead: true,
          isPreviousClanHead: false,
          status: 'living',
        },
        requestedMember: {
          id: 'head-a',
          status: 'living',
          isClanHead: true,
          isPreviousClanHead: false,
        },
        confirmHeadChange: false,
      }),
    (error: unknown) => {
      if (!(error instanceof Error)) return false;
      const typedError = error as Error & {
        status?: number;
        code?: string;
        details?: { currentHeadId?: string };
      };
      return (
        typedError.status === 409 &&
        typedError.code === 'CLAN_HEAD_CONFLICT' &&
        typedError.details?.currentHeadId === 'head-b'
      );
    },
  );
});

void test('preserves the current head when another member is marked previous', () => {
  assert.deepEqual(
    resolveClanHeadChange({
      currentMember: {
        id: 'head-a',
        isClanHead: false,
        isPreviousClanHead: false,
        status: 'deceased',
      },
      currentHead: {
        id: 'head-b',
        fullName: 'Head B',
        isClanHead: true,
        isPreviousClanHead: false,
        status: 'living',
      },
      requestedMember: {
        id: 'head-a',
        status: 'deceased',
        isClanHead: false,
        isPreviousClanHead: true,
      },
      confirmHeadChange: false,
    }),
    {
      isClanHead: false,
      isPreviousClanHead: true,
      previousHeadId: null,
      newHeadId: 'head-b',
      headChanged: false,
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
      location_id: null,
      location_name: null,
      location_address: null,
      location_google_map_url: null,
      save_location: false,
      description: null,
      solarDates: { 2026: '2026-09-27' },
    },
  );
});

void test('normalizes saved clan locations and shared Google Maps URLs', () => {
  assert.deepEqual(
    normalizeLocationInput({
      name: '  Nhà thờ họ ',
      address: '  12 Đường Gia Tộc  ',
      googleMapUrl: 'https://maps.google.com/?q=family',
    }),
    {
      name: 'Nhà thờ họ',
      address: '12 Đường Gia Tộc',
      google_map_url: 'https://maps.google.com/?q=family',
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
