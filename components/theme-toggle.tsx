'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { DEFAULT_LOCALE, type Locale, translate } from '@/lib/i18n';
import {
  THEME_STORAGE_KEY,
  type Theme,
  writeThemePreference,
} from '@/lib/preferences';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const themeListeners = new Set<() => void>();

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
  } catch {
    // Fall back to the operating system preference when storage is unavailable.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function saveThemePreference(theme: Theme) {
  writeThemePreference(window.localStorage, theme);
  themeListeners.forEach((listener) => listener());
}

export function ThemeToggle({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => 'light' as const,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'themeLight' : 'themeDark';
  return (
    <Button
      className="theme-toggle"
      type="button"
      variant="outline"
      aria-label={translate(locale, nextTheme)}
      title={translate(locale, nextTheme)}
      aria-pressed={theme === 'dark'}
      onClick={() => {
        const updatedTheme = theme === 'dark' ? 'light' : 'dark';
        saveThemePreference(updatedTheme);
      }}
    >
      {theme === 'dark' ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
      <span>{translate(locale, nextTheme)}</span>
    </Button>
  );
}
