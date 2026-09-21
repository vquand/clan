import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  DEFAULT_LUNAR_EVENTS,
  mergeDefaultLunarEvents,
} from '../scripts/seed-data.mjs';

void test('defines the important annual Vietnamese lunar observances', () => {
  assert.deepEqual(
    DEFAULT_LUNAR_EVENTS.map((event) => [event.id, event.month, event.day]),
    [
      ['tet-nguyen-dan', 1, 1],
      ['tet-nguyen-tieu', 1, 15],
      ['han-thuc', 3, 3],
      ['doan-ngo', 5, 5],
      ['vu-lan', 7, 15],
      ['trung-thu', 8, 15],
      ['ong-cong-ong-tao', 12, 23],
    ],
  );
  assert.ok(DEFAULT_LUNAR_EVENTS.every((event) => event.calendar === 'lunar'));
  assert.ok(
    DEFAULT_LUNAR_EVENTS.every((event) => event.recurrence === 'annual'),
  );
});

void test('merges lunar defaults without duplicating existing calendar slots', () => {
  const existing = {
    members: [],
    events: [
      {
        id: 'family-tet',
        title: 'Tết gia đình',
        type: 'gathering',
        calendar: 'lunar',
        day: 1,
        month: 1,
        recurrence: 'annual',
        relatedMemberIds: [],
        location: 'Nhà riêng',
      },
    ],
  };

  const merged = mergeDefaultLunarEvents(existing);

  assert.equal(merged.events.length, DEFAULT_LUNAR_EVENTS.length);
  assert.equal(merged.events[0], existing.events[0]);
  assert.equal(
    merged.events.filter(
      (event: { calendar: string; day: number; month: number }) =>
        event.calendar === 'lunar' && event.day === 1 && event.month === 1,
    ).length,
    1,
  );
  assert.equal(existing.events.length, 1);
});

void test('keeps the migration idempotent and aligned with the seed defaults', async () => {
  const migration = await readFile(
    fileURLToPath(
      new URL(
        '../db/migrations/004_add_default_lunar_events.sql',
        import.meta.url,
      ),
    ),
    'utf8',
  );

  assert.match(migration, /INSERT INTO events/i);
  assert.match(migration, /WHERE NOT EXISTS/i);
  for (const event of DEFAULT_LUNAR_EVENTS) {
    assert.match(
      migration,
      new RegExp(event.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    assert.match(
      migration,
      new RegExp(`'lunar',\\s*${event.day},\\s*${event.month},\\s*'annual'`),
    );
  }
});
