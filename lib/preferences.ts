export const READING_SIZES = ['standard', 'large', 'extra-large'] as const;

export type ReadingSize = (typeof READING_SIZES)[number];

export const READING_SIZE_STORAGE_KEY = 'clan-reading-size';

export interface ReadingPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeReadingSize(value: string | null): ReadingSize {
  return READING_SIZES.includes(value as ReadingSize)
    ? (value as ReadingSize)
    : 'standard';
}

export function readReadingSizePreference(
  storage: ReadingPreferenceStorage,
): ReadingSize {
  try {
    return normalizeReadingSize(storage.getItem(READING_SIZE_STORAGE_KEY));
  } catch {
    return 'standard';
  }
}

export function writeReadingSizePreference(
  storage: ReadingPreferenceStorage,
  value: ReadingSize,
) {
  try {
    storage.setItem(READING_SIZE_STORAGE_KEY, value);
  } catch {
    // The visual setting still works for this page when storage is unavailable.
  }
}
