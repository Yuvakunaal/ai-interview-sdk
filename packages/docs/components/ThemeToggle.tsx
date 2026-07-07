'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'isdk-docs-theme';
const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const LABEL: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'Auto' };

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') setTheme(stored);
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="docs-theme-toggle"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${LABEL[theme]}. Click to switch.`}
      title={`Theme: ${LABEL[theme]}`}
    >
      {LABEL[theme]}
    </button>
  );
}
