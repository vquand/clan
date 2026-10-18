import assert from 'node:assert/strict';
import test from 'node:test';

import { members } from '../data/members.ts';
import type { ClanEvent, Member } from '../data/types.ts';
import {
  getCalendarEvents,
  getEventDate,
  getEventDatesForYear,
  getLunarDate,
} from '../lib/clan.ts';
import { syncUpcomingEventReminders } from '../lib/event-reminders.ts';

const ancestor: Member = {
  ...members[0],
  id: 'ancestor',
  deathAnniversaryLunar: { day: 19, month: 3 },
};

void test('member anniversary dates produce annual lunar events without event records', () => {
  const [event] = getCalendarEvents([ancestor], []);
  assert.equal(event.title, `Giỗ ${ancestor.fullName}`);
  assert.equal(event.calendar, 'lunar');
  assert.equal(event.type, 'death-anniversary');
  assert.equal(event.recurrence, 'annual');
  assert.equal(event.day, 19);
  assert.equal(event.month, 3);
  assert.deepEqual(event.relatedMemberIds, [ancestor.id]);
  assert.equal(event.anniversaryMemberId, ancestor.id);
  assert.equal(getCalendarEvents([ancestor], [])[0].id, event.id);
  for (const year of [2026, 2027]) {
    const [date] = getEventDatesForYear(event, year);
    const lunar = getLunarDate(new Date(`${date}T12:00:00`));
    assert.equal(lunar.day, 19);
    assert.equal(lunar.month, 3);
    assert.ok(date.startsWith(`${year}-`));
  }
});

void test('only a matching annual lunar anniversary for the same member suppresses generation', () => {
  const manual: ClanEvent = {
    id: 'manual',
    title: 'Family ceremony',
    type: 'death-anniversary',
    calendar: 'lunar',
    day: 19,
    month: 3,
    recurrence: 'annual',
    relatedMemberIds: [ancestor.id],
    location: 'Family home',
    solarDates: { 2026: '2026-05-06' },
  };
  const merged = getCalendarEvents([ancestor], [manual]);
  assert.deepEqual(merged, [manual]);
  assert.equal(merged[0], manual);
  assert.deepEqual(getEventDatesForYear(merged[0], 2026), ['2026-05-06']);
  for (const different of [
    { ...manual, relatedMemberIds: ['another-member'] },
    { ...manual, type: 'gathering' as const },
    { ...manual, calendar: 'solar' as const },
    { ...manual, recurrence: 'once' as const, year: 2026 },
    { ...manual, day: 18 },
  ]) {
    assert.equal(getCalendarEvents([ancestor], [different]).length, 2);
  }
  const other = { ...ancestor, id: 'other-ancestor' };
  assert.equal(getCalendarEvents([ancestor, other], []).length, 2);
});

void test('anniversaries follow member edits and disappear when their date is removed', () => {
  const original = getCalendarEvents([ancestor], [])[0];
  const edited = getCalendarEvents(
    [
      {
        ...ancestor,
        fullName: 'Updated name',
        deathAnniversaryLunar: { day: 15, month: 8 },
      },
    ],
    [],
    'en',
  )[0];
  assert.equal(edited.id, original.id);
  assert.equal(edited.title, 'Death anniversary of Updated name');
  assert.equal(edited.day, 15);
  assert.equal(edited.month, 8);
  assert.deepEqual(
    getCalendarEvents([{ ...ancestor, deathAnniversaryLunar: undefined }], []),
    [],
  );
  assert.deepEqual(
    getCalendarEvents([{ ...ancestor, status: 'living' }], []),
    [],
  );
  for (const date of [
    { day: 0, month: 1 },
    { day: 31, month: 3 },
    { day: 1, month: 13 },
    { day: 1.5, month: 3 },
  ]) {
    assert.deepEqual(
      getCalendarEvents([{ ...ancestor, deathAnniversaryLunar: date }], []),
      [],
    );
  }
});

void test('thang Chap anniversaries appear in January and in upcoming reminders', () => {
  const [event] = getCalendarEvents(
    [{ ...ancestor, deathAnniversaryLunar: { day: 9, month: 12 } }],
    [],
  );
  assert.deepEqual(getEventDatesForYear(event, 2026), ['2026-01-27']);
  const reminders = syncUpcomingEventReminders(
    [event],
    new Date('2026-01-24T12:00:00'),
    null,
  );
  assert.deepEqual(
    reminders.map(({ date }) => date),
    ['2026-01-27'],
  );
});

void test('a lunar day 30 anniversary uses day 29 in a short month', () => {
  const [event] = getCalendarEvents(
    [{ ...ancestor, deathAnniversaryLunar: { day: 30, month: 4 } }],
    [],
  );
  const [date] = getEventDatesForYear(event, 2026);
  assert.deepEqual(getLunarDate(new Date(`${date}T12:00:00`)), {
    day: 29,
    month: 4,
    year: 2026,
    isLeapMonth: false,
  });
  const nextDay = new Date(`${date}T12:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  assert.equal(getLunarDate(nextDay).day, 1);
});

void test('late lunar months retain one-time years and multiple occurrences in a Gregorian year', () => {
  const [event] = getCalendarEvents(
    [{ ...ancestor, deathAnniversaryLunar: { day: 9, month: 12 } }],
    [],
  );
  const dates = getEventDatesForYear(event, 2022);
  assert.equal(dates.length, 2);
  for (const date of dates) {
    assert.ok(date.startsWith('2022-'));
    const lunar = getLunarDate(new Date(`${date}T12:00:00`));
    assert.equal(lunar.day, 9);
    assert.equal(lunar.month, 12);
  }
  const oneTime = { ...event, recurrence: 'once' as const, year: 2025 };
  assert.deepEqual(getEventDatesForYear(oneTime, 2026), ['2026-01-27']);
  assert.deepEqual(getEventDatesForYear(oneTime, 2027), []);
  assert.deepEqual(getEventDatesForYear({ ...event, day: 0 }, 2026), []);
});

void test('day 30 and the leap-month policy are preserved when those dates exist', () => {
  const [event] = getCalendarEvents(
    [{ ...ancestor, deathAnniversaryLunar: { day: 30, month: 4 } }],
    [],
  );
  const date = getEventDate(event, 2027);
  assert.ok(date);
  assert.equal(getLunarDate(new Date(`${date}T12:00:00`)).day, 30);
  const leapDate = getEventDate({ ...event, day: 1, month: 2 }, 2023);
  assert.equal(leapDate, '2023-03-22');
});
