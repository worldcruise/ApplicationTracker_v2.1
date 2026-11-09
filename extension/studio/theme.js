export const THEME_KEY = 'ui-theme:v1';
const normalize = value => value === 'dark' ? 'dark' : 'light';
const listeners = new Set();
let theme = 'light', error = '', installed = false, queue = Promise.resolve(), revision = 0, pendingWrites = 0;
try { theme = normalize(globalThis.localStorage?.getItem(THEME_KEY) || globalThis.localStorage?.theme); } catch {}

export function applyTheme(value, root = globalThis.document?.documentElement) {
  const next = normalize(value);
  if (root) { root.dataset.theme = next; root.classList.toggle('dark', next === 'dark'); root.classList.toggle('light', next === 'light'); root.style.colorScheme = next; }
  return next;
}
function publish() {
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); localStorage.theme = theme; } catch {}
  for (const listener of listeners) listener({ theme, error });
}
export function installTheme() {
  if (installed) return;
  installed = true; publish();
  const browser = globalThis.chrome;
  if (browser?.storage?.local) {
    const initial = revision;
    browser.storage.local.get(THEME_KEY).then(saved => { if (revision === initial) { theme = normalize(saved[THEME_KEY]); publish(); } })
      .catch(() => { if (revision === initial) { error = 'The saved color theme could not be restored. You can still choose a theme.'; publish(); } });
    browser.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[THEME_KEY] && !pendingWrites) { revision++; theme = normalize(changes[THEME_KEY].newValue); error = ''; publish(); } });
  } else globalThis.addEventListener?.('storage', event => { if (event.key === THEME_KEY) { theme = normalize(event.newValue); publish(); } });
}
export function saveTheme(value) {
  installTheme(); const operation = ++revision;
  theme = normalize(value); error = ''; publish();
  const frozen = theme;
  pendingWrites++;
  queue = queue.then(async () => {
    try {
      if (globalThis.chrome?.storage?.local) await chrome.storage.local.set({ [THEME_KEY]: frozen });
      else localStorage.setItem(THEME_KEY, frozen);
    }
    catch { if (operation === revision) { error = 'The color theme could not be saved. Your current appearance is kept.'; publish(); } }
    finally { pendingWrites--; }
    if (!pendingWrites && operation === revision && !error && globalThis.chrome?.storage?.local) {
      try { const saved = await chrome.storage.local.get(THEME_KEY); if (operation === revision) { theme = normalize(saved[THEME_KEY]); publish(); } } catch {}
    }
  });
  return queue;
}
export function createThemeHook(React) {
  return function useTheme() {
    const [state, setState] = React.useState(() => ({ theme, error }));
    React.useLayoutEffect(() => { applyTheme(state.theme); }, [state.theme]);
    React.useEffect(() => { const changed = next => setState(next); listeners.add(changed); installTheme(); changed({ theme, error }); return () => listeners.delete(changed); }, []);
    return { ...state, setTheme: saveTheme, toggle: () => saveTheme(theme === 'dark' ? 'light' : 'dark'), retry: () => saveTheme(theme) };
  };
}
