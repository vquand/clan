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
  getLunarDate,
  getMoonPhase,
  getSolarDateFromLunar,
  getRelatives,
  validateClanData,
} from '../lib/clan.ts';

void test('sample clan data has valid member and event references', () => {
  assert.deepEqual(validateClanData(members, clanEvents), []);
});

void test('children are derived from parent references and sorted by birth date', () => {
  assert.deepEqual(
    getChildren('an', members).map((member) => member.id),
    ['binh', 'chi', 'dung'],
  );
});

void test('uses the exact birth date when siblings share a birth year', () => {
  const parent = members[0];
  const siblings = [
    {
      ...members[2],
      id: 'later-born',
      fullName: 'Later born',
      birthYear: 1970,
      birthDate: '1970-12-01',
      parentIds: [parent.id],
      spouseIds: [],
    },
    {
      ...members[2],
      id: 'earlier-born',
      fullName: 'Earlier born',
      birthYear: 1970,
      birthDate: '1970-01-01',
      parentIds: [parent.id],
      spouseIds: [],
    },
  ];

  assert.deepEqual(
    getChildren(parent.id, [parent, ...siblings]).map((member) => member.id),
    ['earlier-born', 'later-born'],
  );
});

void test('complete sibling orders override birth dates for the tree', () => {
  const reorderedMembers = members.map((member) => {
    if (member.id === 'binh') {
      return { ...member, birthYear: undefined, birthDate: undefined, siblingOrder: 3 };
    }
    if (member.id === 'chi') {
      return { ...member, birthYear: undefined, birthDate: undefined, siblingOrder: 1 };
    }
    if (member.id === 'dung') {
      return { ...member, birthYear: undefined, birthDate: undefined, siblingOrder: 2 };
    }
    return member;
  });

  assert.deepEqual(
    getChildren('an', reorderedMembers).map((member) => member.id),
    ['chi', 'dung', 'binh'],
  );
});

void test('partial sibling orders do not override the automatic date fallback', () => {
  const partiallyOrderedMembers = members.map((member) =>
    member.id === 'dung' ? { ...member, siblingOrder: 1 } : member,
  );

  assert.deepEqual(
    getChildren('an', partiallyOrderedMembers).map((member) => member.id),
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

void test('direct relationships are described from the selected member', () => {
  assert.equal(
    describeRelationship(members[0], members[2], members),
    'Con gái',
  );
  assert.equal(describeRelationship(members[2], members[0], members), 'Cha');
  assert.equal(describeRelationship(members[0], members[1], members), 'Vợ');
});

void test('orders relatives by parents, siblings, then each child with their spouse', () => {
  const selected = {
    ...members[2],
    id: 'selected',
    fullName: 'Selected member',
    parentIds: ['mother', 'father'],
    spouseIds: ['partner'],
    siblingOrder: 2,
  };
  const father = {
    ...members[0],
    id: 'father',
    fullName: 'Father',
    gender: 'male' as const,
    parentIds: [],
    spouseIds: [],
  };
  const mother = {
    ...members[1],
    id: 'mother',
    fullName: 'Mother',
    gender: 'female' as const,
    parentIds: [],
    spouseIds: [],
  };
  const olderSibling = {
    ...members[3],
    id: 'older-sibling',
    fullName: 'Older sibling',
    parentIds: ['father', 'mother'],
    spouseIds: [],
    siblingOrder: 1,
  };
  const youngerSibling = {
    ...members[4],
    id: 'younger-sibling',
    fullName: 'Younger sibling',
    parentIds: ['father', 'mother'],
    spouseIds: [],
    siblingOrder: 3,
  };
  const partner = {
    ...members[6],
    id: 'partner',
    fullName: 'Partner',
    parentIds: [],
    spouseIds: ['selected'],
  };
  const childA = {
    ...members[8],
    id: 'child-a',
    fullName: 'Child A',
    parentIds: ['selected'],
    spouseIds: ['child-a-spouse'],
    siblingOrder: 1,
  };
  const childASpouse = {
    ...members[6],
    id: 'child-a-spouse',
    fullName: 'Child A spouse',
    parentIds: [],
    spouseIds: ['child-a'],
  };
  const childB = {
    ...members[9],
    id: 'child-b',
    fullName: 'Child B',
    parentIds: ['selected'],
    spouseIds: ['child-b-spouse'],
    siblingOrder: 2,
  };
  const childBSpouse = {
    ...members[6],
    id: 'child-b-spouse',
    fullName: 'Child B spouse',
    parentIds: [],
    spouseIds: ['child-b'],
  };

  const related = getRelatives(selected, [
    childBSpouse,
    mother,
    childA,
    youngerSibling,
    childASpouse,
    father,
    partner,
    selected,
    childB,
    olderSibling,
  ]);

  assert.deepEqual(related.map((member) => member.id), [
    'father',
    'mother',
    'partner',
    'older-sibling',
    'younger-sibling',
    'child-a',
    'child-a-spouse',
    'child-b',
    'child-b-spouse',
  ]);
});

void test('a member is never included in their own relationship list', () => {
  const chi = members.find((member) => member.id === 'chi')!;
  assert.ok(!getRelatives(chi, members).some((member) => member.id === chi.id));
});

void test('fixed annual events resolve into the requested year', () => {
  assert.equal(getEventDate(clanEvents[1], 2027), '2027-04-18');
});

void test('calendar dates convert between solar and Vietnamese lunar dates', () => {
  assert.deepEqual(getLunarDate(new Date('2026-04-28T00:00:00')), {
    year: 2026,
    month: 3,
    day: 12,
    isLeapMonth: false,
  });
  assert.equal(
    getSolarDateFromLunar({ year: 2026, month: 3, day: 12 }),
    '2026-04-28',
  );
});

void test('lunar event dates use the leap occurrence when the target month repeats', () => {
  assert.deepEqual(getLunarDate(new Date('2023-03-22T00:00:00')), {
    year: 2023,
    month: 2,
    day: 1,
    isLeapMonth: true,
  });
  assert.equal(
    getSolarDateFromLunar(
      { year: 2023, month: 2, day: 1 },
      { preferLeapMonth: true },
    ),
    '2023-03-22',
  );
});

void test('calendar grid always contains complete weeks', () => {
  const days = buildCalendarDays(2026, 8);
  assert.equal(days.length % 7, 0);
  assert.ok(days.length >= 35);
  assert.equal(days[0]?.date.getDay(), 1);
});

void test('moon phases progress from new moon to full moon and back', () => {
  assert.equal(getMoonPhase(1), 'new');
  assert.equal(getMoonPhase(8), 'first-quarter');
  assert.equal(getMoonPhase(15), 'full');
  assert.equal(getMoonPhase(23), 'last-quarter');
  assert.equal(getMoonPhase(30), 'new');
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
