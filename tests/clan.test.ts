import assert from 'node:assert/strict';
import test from 'node:test';

import { clanEvents } from '../data/events.ts';
import { members } from '../data/members.ts';
import {
  buildCalendarDays,
  describeRelationship,
  getChildren,
  orderCoupleMembers,
  getEventDate,
  getGenerationFilters,
  getGenerations,
  getRelatives,
  validateClanData,
} from '../lib/clan.ts';

void test('sample clan data has valid member and event references', () => {
  assert.deepEqual(validateClanData(members, clanEvents), []);
});

void test('children are derived from parent references and sorted by birth year', () => {
  assert.deepEqual(
    getChildren('an', members).map((member) => member.id),
    ['binh', 'chi', 'dung'],
  );
});

void test('couples place male members on the left and female members on the right', () => {
  const female = members.find((member) => member.id === 'chi')!;
  const male = members.find((member) => member.id === 'hoa')!;

  assert.deepEqual(
    orderCoupleMembers(female, male).map((member) => member.id),
    ['hoa', 'chi'],
  );
  assert.deepEqual(
    orderCoupleMembers(male, female).map((member) => member.id),
    ['hoa', 'chi'],
  );
});

void test('generation filters are derived from the supplied clan data', () => {
  assert.deepEqual(getGenerations(members), [1, 2, 3]);
  assert.deepEqual(
    getGenerations([
      { ...members[0], generation: 4 },
      { ...members[1], generation: 1 },
    ]),
    [1, 4],
  );
});

void test('generation filters include level zero and future generations', () => {
  assert.deepEqual(
    getGenerationFilters([
      { ...members[0], generation: 0 },
      { ...members[1], generation: 5 },
    ]),
    ['all', 0, 5],
  );
});

void test('direct relationships are described from the selected member', () => {
  assert.equal(
    describeRelationship(members[0], members[2], members),
    'Con gái',
  );
  assert.equal(describeRelationship(members[2], members[0], members), 'Cha');
  assert.equal(describeRelationship(members[0], members[1], members), 'Vợ');
});

void test('a member is never included in their own relationship list', () => {
  const chi = members.find((member) => member.id === 'chi')!;
  assert.ok(!getRelatives(chi, members).some((member) => member.id === chi.id));
});

void test('fixed annual events resolve into the requested year', () => {
  assert.equal(getEventDate(clanEvents[1], 2027), '2027-04-18');
});

void test('calendar grid always contains complete weeks', () => {
  const days = buildCalendarDays(2026, 8);
  assert.equal(days.length % 7, 0);
  assert.ok(days.length >= 35);
  assert.equal(days[0]?.date.getDay(), 1);
});

void test('parent cycles are rejected before a tree can be rendered', () => {
  const cyclicMembers = members.map((member) => ({
    ...member,
    parentIds: member.id === 'an' ? ['chi'] : member.parentIds,
  }));
  assert.match(
    validateClanData(cyclicMembers, clanEvents).join('\n'),
    /Vòng lặp/,
  );
});
