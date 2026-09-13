import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatMemberAge,
  getMemberAvatarSource,
  getMemberAvatarVariant,
} from '../lib/member-display.ts';
import type { Member } from '../data/types.ts';

const baseMember: Member = {
  id: '00000000-0000-4000-8000-000000000001',
  fullName: 'Test Member',
  gender: 'male',
  clanRelation: 'lineage',
  generation: 0,
  parentIds: [],
  spouseIds: [],
};

void test('wraps a deceased member age in memorial brackets', () => {
  assert.equal(
    formatMemberAge({
      ...baseMember,
      status: 'deceased',
      birthDate: '1926-10-02',
      deathDate: '2024-09-10',
    }),
    '[97]',
  );
});

void test('shows a living member age without memorial brackets', () => {
  assert.equal(
    formatMemberAge(
      {
        ...baseMember,
        status: 'living',
        birthDate: '1976-01-01',
      },
      new Date('2026-09-13T00:00:00Z'),
    ),
    '50',
  );
});

void test('uses the local calendar date for a living member age', () => {
  assert.equal(
    formatMemberAge(
      {
        ...baseMember,
        status: 'living',
        birthDate: '1976-09-13',
      },
      new Date('2026-09-13T00:30:00+07:00'),
    ),
    '50',
  );
});

void test('brackets an unknown age only when the member is deceased', () => {
  assert.equal(
    formatMemberAge({ ...baseMember, status: 'deceased' }),
    '[ -- ]',
  );
  assert.equal(formatMemberAge({ ...baseMember, status: 'living' }), '--');
  assert.equal(formatMemberAge(baseMember), '--');
});

void test('uses year precision when only the birth year is known', () => {
  assert.equal(
    formatMemberAge(
      { ...baseMember, status: 'living', birthYear: 1976 },
      new Date('2026-09-13T00:00:00Z'),
    ),
    '50',
  );
  assert.equal(
    formatMemberAge({
      ...baseMember,
      status: 'deceased',
      birthYear: 1927,
      deathDate: '2024-04-01',
    }),
    '[97]',
  );
});

void test('calculates age when a member has birth data but no life status', () => {
  assert.equal(
    formatMemberAge(
      { ...baseMember, birthYear: 1952 },
      new Date('2026-09-13T00:30:00+07:00'),
    ),
    '74',
  );
  assert.equal(
    formatMemberAge(
      { ...baseMember, birthDate: '1952-09-13' },
      new Date('2026-09-13T00:30:00+07:00'),
    ),
    '74',
  );
});

void test('uses an approximate senior age group when exact dates are unavailable', () => {
  const member = {
    ...baseMember,
    gender: 'female' as const,
    status: 'deceased' as const,
    ageGroup: 'senior' as const,
  };

  assert.equal(getMemberAvatarVariant(member), 'senior-woman');
  assert.equal(formatMemberAge(member), '[60+]');
});

void test('selects people icons from gender and age', () => {
  const referenceDate = new Date('2026-09-13T00:00:00Z');
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'male', birthYear: 1980, status: 'living' },
      referenceDate,
    ),
    'male',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'female', birthYear: 1980, status: 'living' },
      referenceDate,
    ),
    'female',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'male', birthYear: 2001, status: 'living' },
      referenceDate,
    ),
    'male',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'female', birthYear: 1966, status: 'living' },
      referenceDate,
    ),
    'senior-woman',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'male', birthYear: 1966, status: 'living' },
      referenceDate,
    ),
    'senior-man',
  );
  assert.equal(
    getMemberAvatarVariant(
      {
        ...baseMember,
        gender: 'male',
        birthDate: '2000-09-13',
        deathDate: '2026-09-13',
        status: 'deceased',
      },
      referenceDate,
    ),
    'male',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'male', birthYear: 2005, status: 'living' },
      referenceDate,
    ),
    'young-man',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'female', birthYear: 2005, status: 'living' },
      referenceDate,
    ),
    'young-woman',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'male', birthYear: 2018, status: 'living' },
      referenceDate,
    ),
    'toddler-boy',
  );
  assert.equal(
    getMemberAvatarVariant(
      { ...baseMember, gender: 'female', birthYear: 2018, status: 'living' },
      referenceDate,
    ),
    'toddler-girl',
  );
  assert.equal(
    getMemberAvatarVariant(
      {
        ...baseMember,
        gender: 'female',
        birthDate: '2025-01-01',
        status: 'living',
      },
      referenceDate,
    ),
    'baby',
  );
  assert.equal(
    getMemberAvatarVariant({ ...baseMember, gender: 'other' }, referenceDate),
    'unknown',
  );
  assert.equal(
    getMemberAvatarVariant({ ...baseMember, gender: 'male' }, referenceDate),
    'male',
  );
});

void test('uses a selected hairstyle or a real image when available', () => {
  const member = {
    ...baseMember,
    status: 'living' as const,
    birthYear: 1980,
  };

  assert.equal(
    getMemberAvatarSource({ ...member, avatarStyle: 'default' }),
    '/people-icons/male.png',
  );
  assert.equal(
    getMemberAvatarSource({ ...member, avatarStyle: 'style-2' }),
    '/people-icons/male-style-2.png',
  );
  assert.equal(
    getMemberAvatarSource({
      ...member,
      avatarStyle: 'style-3',
      avatarImageUrl: '/family/portraits/member.jpg',
    }),
    '/family/portraits/member.jpg',
  );
});
