import type { ClanEvent } from '../data/types.ts';
import { getEventDate } from './clan.ts';
import { type Locale, translate } from './i18n.ts';
import { getBrowserStorage, type StringStorage } from './local-storage.ts';

export const EVENT_REMINDER_STORAGE_KEY = 'clan-event-reminders-v1';
export const REMINDER_HORIZON_DAYS = 31;
export const REMINDER_WINDOW_DAYS = 3;

export type ReminderEvent = ClanEvent;

export interface ReminderEntry {
  occurrenceKey: string;
  eventId: string;
  title: string;
  date: string;
  calendar: ClanEvent['calendar'];
}

export interface ReminderState {
  schedule: ReminderEntry[];
  sent: Record<string, string>;
}

export interface DueReminder extends ReminderEntry {
  daysUntil: number;
}

export interface ReminderNotification {
  title: string;
  options: {
    body: string;
    icon: string;
    badge: string;
    tag: string;
    renotify: false;
    data: {
      eventId: string;
      date: string;
      url: string;
    };
  };
}

const EMPTY_STATE: ReminderState = { schedule: [], sent: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReminderEntry(value: unknown): value is ReminderEntry {
  return (
    isRecord(value) &&
    typeof value.occurrenceKey === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.date === 'string' &&
    (value.calendar === 'solar' || value.calendar === 'lunar')
  );
}

function localIsoDate(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, '0'),
    )
    .join('-');
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

function utcDateValue(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(from: string, to: string) {
  return Math.round((utcDateValue(to) - utcDateValue(from)) / 86_400_000);
}

function isDateString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(utcDateValue(value))
  );
}

export function readReminderState(
  storage: StringStorage | null = getBrowserStorage(),
): ReminderState {
  if (!storage) return { ...EMPTY_STATE, sent: {} };

  try {
    const raw = storage.getItem(EVENT_REMINDER_STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE, sent: {} };
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return { ...EMPTY_STATE, sent: {} };

    const schedule = Array.isArray(value.schedule)
      ? value.schedule.filter(isReminderEntry)
      : [];
    const sent: Record<string, string> = {};
    if (isRecord(value.sent)) {
      for (const [key, sentAt] of Object.entries(value.sent)) {
        if (isDateString(sentAt)) sent[key] = sentAt;
      }
    }
    return { schedule, sent };
  } catch {
    return { ...EMPTY_STATE, sent: {} };
  }
}

function writeReminderState(
  state: ReminderState,
  storage: StringStorage | null,
) {
  if (!storage) return;

  try {
    storage.setItem(EVENT_REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local storage is an enhancement. A full or blocked store must not stop the archive.
  }
}

export function syncUpcomingEventReminders(
  events: ReminderEvent[],
  today: Date,
  storage: StringStorage | null = getBrowserStorage(),
  horizonDays = REMINDER_HORIZON_DAYS,
) {
  const start = localIsoDate(today);
  const end = localIsoDate(addDays(today, horizonDays));
  const startYear = today.getFullYear();
  const entries = new Map<string, ReminderEntry>();

  for (const event of events) {
    for (const year of [startYear, startYear + 1]) {
      const date = getEventDate(event, year);
      if (!date || date < start || date > end) continue;

      const occurrenceKey = `${event.id}:${date}`;
      entries.set(occurrenceKey, {
        occurrenceKey,
        eventId: event.id,
        title: event.title,
        date,
        calendar: event.calendar,
      });
    }
  }

  const schedule = [...entries.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
  const previous = readReminderState(storage);
  const state = { schedule, sent: previous.sent };
  writeReminderState(state, storage);
  return state.schedule;
}

export function getDueReminders(state: ReminderState, today: Date) {
  const todayIso = localIsoDate(today);
  return state.schedule.reduce<DueReminder[]>((due, entry) => {
    const daysUntil = daysBetween(todayIso, entry.date);
    if (
      daysUntil >= 0 &&
      daysUntil <= REMINDER_WINDOW_DAYS &&
      !state.sent[entry.occurrenceKey]
    ) {
      due.push({ ...entry, daysUntil });
    }
    return due;
  }, []);
}

export function getReminderNotification(
  entry: DueReminder,
  locale: Locale,
): ReminderNotification {
  const body =
    entry.daysUntil === 0
      ? translate(locale, 'notificationToday', { event: entry.title })
      : translate(locale, 'notificationInDays', {
          event: entry.title,
          count: entry.daysUntil,
        });

  return {
    title: translate(locale, 'notificationTitle'),
    options: {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `clan-event-reminder:${entry.occurrenceKey}`,
      renotify: false,
      data: {
        eventId: entry.eventId,
        date: entry.date,
        url: '/#calendar',
      },
    },
  };
}

export async function deliverDueEventReminders(
  due: DueReminder[],
  locale: Locale,
  storage: StringStorage | null = getBrowserStorage(),
  today = new Date(),
  showNotification: (notification: ReminderNotification) => Promise<void>,
) {
  let sentCount = 0;
  const state = readReminderState(storage);
  const sentAt = localIsoDate(today);

  for (const entry of due) {
    try {
      await showNotification(getReminderNotification(entry, locale));
      state.sent[entry.occurrenceKey] = sentAt;
      sentCount += 1;
    } catch {
      // Do not mark failed notifications as sent: a later app open can retry them.
    }
  }

  writeReminderState(state, storage);
  return sentCount;
}
