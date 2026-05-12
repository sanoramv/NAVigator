const STORAGE_KEY = 'navigator-theme';

/** Read saved preference or system preference, apply to <html data-theme>. */
export function initTheme() {
  const saved     = localStorage.getItem(STORAGE_KEY);
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', saved ?? preferred);
}

/** Toggle between light and dark, save preference to localStorage. */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}
