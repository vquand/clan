import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import {
  readCachedClanData,
  writeCachedClanData,
} from '../lib/offline-clan-cache.ts';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const clanData = {
  members: [
    {
      id: 'member-1',
      fullName: 'Member',
      gender: 'other' as const,
      clanRelation: 'lineage' as const,
      birthYear: 1980,
      generation: 1,
      parentIds: [],
      spouseIds: [],
      branch: 'main',
      status: 'living' as const,
    },
  ],
  events: [],
  locations: [],
};

void test('offline clan cache round-trips validated clan data', () => {
  const storage = new MemoryStorage();

  ok(writeCachedClanData(clanData, storage));
  deepStrictEqual(readCachedClanData(storage), clanData);
});

void test('offline clan cache ignores malformed or invalid data', () => {
  const storage = new MemoryStorage();
  storage.setItem('clan-data-cache-v1', '{not-json');
  equal(readCachedClanData(storage), null);

  storage.setItem('clan-data-cache-v1', JSON.stringify({ members: [] }));
  equal(readCachedClanData(storage), null);
});
