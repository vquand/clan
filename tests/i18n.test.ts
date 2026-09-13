import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_LOCALE, getIntlLocale, translate } from '../lib/i18n.ts';
import {
  normalizeReadingSize,
  readReadingSizePreference,
  writeReadingSizePreference,
} from '../lib/preferences.ts';

void test('Vietnamese is always the default locale', () => {
  assert.equal(DEFAULT_LOCALE, 'vi');
  assert.equal(translate(DEFAULT_LOCALE, 'tabMembers'), 'Thành viên');
});

void test('English and French interface translations are available', () => {
  assert.equal(translate('en', 'tabTree'), 'Family tree');
  assert.equal(translate('fr', 'tabCalendar'), 'Calendrier');
  assert.equal(getIntlLocale('fr'), 'fr-FR');
});

void test('translation placeholders are interpolated', () => {
  assert.equal(
    translate('en', 'memberCount', { count: 10, generations: 3 }),
    '10 people · 3 generations',
  );
});

void test('unknown reading-size preferences fall back to standard', () => {
  assert.equal(normalizeReadingSize('large'), 'large');
  assert.equal(normalizeReadingSize('unexpected'), 'standard');
  assert.equal(normalizeReadingSize(null), 'standard');
});

void test('reading preferences tolerate unavailable browser storage', () => {
  const blockedStorage = {
    getItem: () => {
      throw new Error('storage blocked');
    },
    setItem: () => {
      throw new Error('storage blocked');
    },
  };

  assert.equal(readReadingSizePreference(blockedStorage), 'standard');
  assert.doesNotThrow(() =>
    writeReadingSizePreference(blockedStorage, 'extra-large'),
  );
});
