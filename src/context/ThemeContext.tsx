import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemeValue = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeValue;
  resolvedTheme: 'light' | 'dark';
  setTheme: (next: ThemeValue | ((prev: ThemeValue) => ThemeValue)) => void;
  themes: ThemeValue[];
}

const STORAGE_KEY = 'theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(defaultTheme: ThemeValue): ThemeValue {
  if (typeof window === 'undefined') return defaultTheme;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return defaultTheme;
}

function applyThemeToDom(resolved: 'light' | 'dark', attribute: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (attribute === 'class') {
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  } else {
    root.setAttribute(attribute, resolved);
  }
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  attribute = 'class'
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeValue;
  attribute?: string;
}) {
  const [theme, setThemeState] = useState<ThemeValue>(() => readStoredTheme(defaultTheme));
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    applyThemeToDom(resolvedTheme, attribute);
  }, [resolvedTheme, attribute]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
          setThemeState(e.newValue);
        } else {
          setThemeState(defaultTheme);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [defaultTheme]);

  const setTheme = useCallback(
    (next: ThemeValue | ((prev: ThemeValue) => ThemeValue)) => {
      setThemeState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        try {
          window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
          // Ignore storage access errors
        }
        return value;
      });
    },
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      themes: ['light', 'dark', 'system']
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: () => {},
      themes: ['light', 'dark', 'system']
    };
  }
  return ctx;
}
