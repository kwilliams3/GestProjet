import { useState } from 'react';

/** Thème clair/sombre : appliqué sur <html data-theme> et mémorisé dans le navigateur. */
export function useTheme() {
  const [theme, setThemeState] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  function setTheme(next) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('gp_theme', next);
    } catch {
      // Préférence non mémorisée, sans conséquence.
    }
    setThemeState(next);
  }

  return [theme, setTheme];
}
