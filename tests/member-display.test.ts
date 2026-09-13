import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMemberAge } from '../lib/member-display.ts';
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
