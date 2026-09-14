import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSeedData } from '../scripts/seed-data.mjs';
import { assembleClanData } from '../server/clan-data.mjs';

void test('converts import-only keys into generated database IDs', () => {
  const generatedIds = [
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000012',
  ];
  const normalized = normalizeSeedData(
    {
      members: [
        {
          id: 'person-name-slug',
          fullName: 'Person One',
          gender: 'female',
          clanRelation: 'lineage',
          generation: 9,
          branch: 'Invented branch',
          ageGroup: 'senior',
          avatarStyle: 'style-1',
          avatarImageUrl: '/family/portraits/person-one.jpg',
          parentIds: [],
          spouseIds: ['another-name-slug'],
        },
        {
          id: 'another-name-slug',
          fullName: 'Person Two',
          gender: 'male',
          clanRelation: 'marriage',
          generation: 9,
          branch: 'Invented branch',
          parentIds: [],
          spouseIds: ['person-name-slug'],
        },
      ],
      events: [
        {
          id: 'event-title-slug',
          title: 'Gathering',
          type: 'gathering',
          calendar: 'solar',
          day: 1,
          month: 1,
          recurrence: 'annual',
          relatedMemberIds: ['person-name-slug'],
          location: 'Home',
          locationId: 'family-home',
        },
      ],
      locations: [
        {
          id: 'family-home',
          name: 'Home',
          address: '123 Family Road',
          googleMapUrl: 'https://maps.google.com/?q=family',
        },
      ],
    },
    () => generatedIds.shift(),
  );

  assert.equal(
    normalized.members[0].id,
    '00000000-0000-4000-8000-000000000011',
  );
  assert.equal(normalized.members[0].full_name, 'Person One');
  assert.equal(normalized.members[0].clan_relation, 'lineage');
  assert.equal(normalized.members[0].age_group, 'senior');
  assert.equal(normalized.members[0].avatar_style, 'style-1');
  assert.equal(
    normalized.members[0].avatar_image_url,
    '/family/portraits/person-one.jpg',
  );
  assert.equal(normalized.members[1].clan_relation, 'marriage');
  assert.equal('generation' in normalized.members[0], false);
  assert.equal('branch' in normalized.members[0], false);
  assert.deepEqual(normalized.spouses, [
    {
      member_a_id: '00000000-0000-4000-8000-000000000011',
      member_b_id: '00000000-0000-4000-8000-000000000012',
    },
  ]);
  assert.deepEqual(normalized.eventMembers, [
    {
      event_id: '10000000-0000-4000-8000-000000000011',
      member_id: '00000000-0000-4000-8000-000000000011',
    },
  ]);
  assert.deepEqual(normalized.locations, [
    {
      id: '10000000-0000-4000-8000-000000000012',
      name: 'Home',
      address: '123 Family Road',
      google_map_url: 'https://maps.google.com/?q=family',
    },
  ]);
  assert.equal(normalized.events[0].location_id, '10000000-0000-4000-8000-000000000012');
});

void test('requires an explicit clan relationship for every seed member', () => {
  assert.throws(
    () =>
      normalizeSeedData(
        {
          members: [
            {
              id: 'member-without-relation',
              fullName: 'Unclassified Person',
              gender: 'other',
              parentIds: [],
              spouseIds: [],
            },
          ],
          events: [],
        },
        () => '00000000-0000-4000-8000-000000000001',
      ),
    /must declare clanRelation/i,
  );
});

void test('assembles the API dataset from relational rows and derives generations', () => {
  const data = assembleClanData({
    memberRows: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        full_name: 'Founder',
        gender: 'male',
        clan_relation: 'lineage',
        birth_year: 1926,
        sibling_order: 4,
        death_year: 1986,
        age_at_death: 60,
        age_at_death_qualifier: 'approximately',
        age_group: 'senior',
        avatar_style: 'style-2',
        avatar_image_url: '/family/portraits/founder.jpg',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        full_name: 'Founder spouse',
        gender: 'female',
        clan_relation: 'marriage',
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        full_name: 'Child',
        gender: 'female',
        clan_relation: 'lineage',
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        full_name: 'Child spouse',
        gender: 'male',
        clan_relation: 'marriage',
      },
    ],
    parentRows: [
      {
        child_id: '00000000-0000-4000-8000-000000000003',
        parent_id: '00000000-0000-4000-8000-000000000001',
      },
      {
        child_id: '00000000-0000-4000-8000-000000000003',
        parent_id: '00000000-0000-4000-8000-000000000002',
      },
    ],
    spouseRows: [
      {
        member_a_id: '00000000-0000-4000-8000-000000000001',
        member_b_id: '00000000-0000-4000-8000-000000000002',
      },
      {
        member_a_id: '00000000-0000-4000-8000-000000000003',
        member_b_id: '00000000-0000-4000-8000-000000000004',
      },
    ],
    eventRows: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        title: 'Family gathering',
        type: 'gathering',
        calendar: 'lunar',
        day: 15,
        month: 8,
        recurrence: 'annual',
        location: 'Family home',
      },
    ],
    eventMemberRows: [
      {
        event_id: '10000000-0000-4000-8000-000000000001',
        member_id: '00000000-0000-4000-8000-000000000003',
      },
    ],
    eventSolarDateRows: [
      {
        event_id: '10000000-0000-4000-8000-000000000001',
        year: 2027,
        solar_date: '2027-09-15',
      },
    ],
  });

  assert.deepEqual(
    data.members.map(
      (member: {
        id: string;
        fullName: string;
        generation: number;
        clanRelation: string;
        branch?: string;
      }) => ({
        id: member.id,
        fullName: member.fullName,
        generation: member.generation,
        clanRelation: member.clanRelation,
        branch: member.branch,
      }),
    ),
    [
      {
        id: '00000000-0000-4000-8000-000000000001',
        fullName: 'Founder',
        generation: 0,
        clanRelation: 'lineage',
        branch: undefined,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        fullName: 'Founder spouse',
        generation: 0,
        clanRelation: 'marriage',
        branch: undefined,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        fullName: 'Child',
        generation: 1,
        clanRelation: 'lineage',
        branch: undefined,
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        fullName: 'Child spouse',
        generation: 1,
        clanRelation: 'marriage',
        branch: undefined,
      },
    ],
  );
  assert.deepEqual(data.members[2].parentIds, [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ]);
  assert.deepEqual(data.members[2].spouseIds, [
    '00000000-0000-4000-8000-000000000004',
  ]);
  assert.equal(data.members[0].ageGroup, 'senior');
  assert.equal(data.members[0].birthYear, 1926);
  assert.equal(data.members[0].siblingOrder, 4);
  assert.equal(data.members[0].deathYear, 1986);
  assert.equal(data.members[0].ageAtDeath, 60);
  assert.equal(data.members[0].ageAtDeathQualifier, 'approximately');
  assert.equal(data.members[0].avatarStyle, 'style-2');
  assert.equal(data.members[0].avatarImageUrl, '/family/portraits/founder.jpg');
  assert.deepEqual(data.events, [
    {
      id: '10000000-0000-4000-8000-000000000001',
      title: 'Family gathering',
      type: 'gathering',
      calendar: 'lunar',
      day: 15,
      month: 8,
      recurrence: 'annual',
      relatedMemberIds: ['00000000-0000-4000-8000-000000000003'],
      location: 'Family home',
      solarDates: { 2027: '2027-09-15' },
    },
  ]);
});
