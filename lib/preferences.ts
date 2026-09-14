export const READING_SIZES = ['standard', 'large', 'extra-large'] as const;

export type ReadingSize = (typeof READING_SIZES)[number];

export const READING_SIZE_STORAGE_KEY = 'clan-reading-size';
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'clan-theme';

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

export function normalizeTheme(value: string | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : 'light';
}

export function readThemePreference(storage: ReadingPreferenceStorage): Theme {
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'light';
  }
}

export function writeThemePreference(
  storage: ReadingPreferenceStorage,
  value: Theme,
) {
  try {
    storage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // The visual setting still works for this page when storage is unavailable.
  }
}
