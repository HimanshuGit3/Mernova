import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './themeContext.js';

const KEY = 'fixit-theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Light/dark theme: a `.dark` class on <html> swaps every token in index.css. */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B1223' : '#0F1F3D');
  }, [theme]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme],
  );
  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
