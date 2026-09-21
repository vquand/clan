import { deepStrictEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import {
  deliverDueEventReminders,
  getDueReminders,
  readReminderState,
  syncUpcomingEventReminders,
  type ReminderEvent,
} from '../lib/event-reminders.ts';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function dateAtNoon(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12);
}

function solarEvent(
  id: string,
  title: string,
  year: number,
  month: number,
  day: number,
): ReminderEvent {
  return {
    id,
    title,
    type: 'gathering',
    calendar: 'solar',
    day,
    month,
    recurrence: 'annual',
    year,
    relatedMemberIds: [],
    location: '',
  };
}

void test('sync stores annual occurrences for the next 31 days', () => {
  const storage = new MemoryStorage();
  const today = dateAtNoon(2026, 12, 20);
  const entries = syncUpcomingEventReminders(
    [
      solarEvent('christmas', 'Christmas', 2026, 12, 25),
      solarEvent('new-year', 'New Year', 2027, 1, 1),
      solarEvent('far-away', 'Far away', 2027, 2, 1),
    ],
    today,
    storage,
  );

  deepStrictEqual(
    entries.map((entry) => [entry.eventId, entry.date]),
    [
      ['christmas', '2026-12-25'],
      ['new-year', '2027-01-01'],
    ],
  );
  equal(readReminderState(storage).schedule.length, 2);
});

void test('due reminders use the T-3 through T fallback window', () => {
  const storage = new MemoryStorage();
  const today = dateAtNoon(2026, 9, 21);
  const schedule = syncUpcomingEventReminders(
    [solarEvent('family-day', 'Family day', 2026, 9, 24)],
    today,
    storage,
  );

  equal(getDueReminders({ schedule, sent: {} }, today)[0]?.daysUntil, 3);
  equal(
    getDueReminders({ schedule, sent: {} }, dateAtNoon(2026, 9, 22))[0]
      ?.daysUntil,
    2,
  );
  equal(
    getDueReminders({ schedule, sent: {} }, dateAtNoon(2026, 9, 23))[0]
      ?.daysUntil,
    1,
  );
  equal(
    getDueReminders({ schedule, sent: {} }, dateAtNoon(2026, 9, 24))[0]
      ?.daysUntil,
    0,
  );
  equal(
    getDueReminders({ schedule, sent: {} }, dateAtNoon(2026, 9, 25)).length,
    0,
  );
});

void test('sent occurrences are skipped, while a missed T-3 can send later', async () => {
  const storage = new MemoryStorage();
  const today = dateAtNoon(2026, 9, 21);
  const schedule = syncUpcomingEventReminders(
    [solarEvent('family-day', 'Family day', 2026, 9, 24)],
    today,
    storage,
  );
  const sentTitles: string[] = [];

  const sentCount = await deliverDueEventReminders(
    getDueReminders({ schedule, sent: {} }, dateAtNoon(2026, 9, 22)),
    'en',
    storage,
    dateAtNoon(2026, 9, 22),
    async (notification) => {
      sentTitles.push(notification.options.body);
    },
  );

  equal(sentCount, 1);
  equal(sentTitles.length, 1);
  equal(
    getDueReminders(readReminderState(storage), dateAtNoon(2026, 9, 23)).length,
    0,
  );
});

void test('failed delivery is not marked as sent and can retry', async () => {
  const storage = new MemoryStorage();
  const today = dateAtNoon(2026, 9, 21);
  const schedule = syncUpcomingEventReminders(
    [solarEvent('family-day', 'Family day', 2026, 9, 24)],
    today,
    storage,
  );
  const due = getDueReminders({ schedule, sent: {} }, today);

  equal(
    await deliverDueEventReminders(due, 'vi', storage, today, async () => {
      throw new Error('notification unavailable');
    }),
    0,
  );
  equal(getDueReminders(readReminderState(storage), today).length, 1);
});
