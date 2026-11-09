export const WEB_PAGES = [
  { name: 'Dashboard', path: '/dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { name: 'Resume Studio', path: '/resume-studio', icon: 'M14 3H5v18h14v-8M14 3v6h6M9 16l9-9 3 3-9 9-4 1z' },
  { name: 'Applications', path: '/', icon: 'M8 6V3h8v3M3 6h18v15H3zM3 11h18M10 11v3h4v-3' },
  { name: 'Meetings', path: '/meetings', icon: 'M4 5h16v16H4zM8 2v6m8-6v6M4 11h16M8 15h3m2 0h3' },
  { name: 'Settings', path: '/settings', startsWith: true, icon: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6' },
];

export function createWebHeader(React) {
  const h = React.createElement;
  const useTheme = createThemeHook(React);
  function ThemeButton() {
    const theme = useTheme();
    return h('div', { className: 'web-theme-control' },
      h('button', { type: 'button', className: 'web-theme-toggle', onClick: theme.toggle,
        title: `Switch to ${theme.theme === 'dark' ? 'light' : 'dark'} theme`,
        'aria-label': `Switch to ${theme.theme === 'dark' ? 'light' : 'dark'} theme`, 'aria-pressed': theme.theme === 'dark' },
        h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', 'aria-hidden': true },
          h('path', { d: theme.theme === 'dark' ? 'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z' : 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' }))),
      theme.error && h('button', { type: 'button', className: 'web-theme-error', role: 'alert', onClick: theme.retry }, `${theme.error} Retry`));
  }
  return function WebHeader({ active, items = WEB_PAGES, Link, StudioLink }) {
    const [navigationError, setNavigationError] = React.useState('');
    const base = globalThis.chrome?.runtime?.getURL('options.html') || 'options.html';
    const link = (path, props, children, Studio = false) => h(Studio && StudioLink || Link || 'a', {
      ...props, ...(Link || Studio && StudioLink ? { to: path } : { href: `${base}#${path}` }),
      ...(!Link && !(Studio && StudioLink) ? { onClick: event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); setNavigationError('');
        openDashboard(path).catch(error => setNavigationError(error.message));
      } } : {}),
    }, children);
    return h('header', { className: 'autofill-web-header' },
      h('div', { className: 'autofill-web-header-inner' },
        link('/dashboard', { className: 'autofill-web-brand', 'aria-label': `${APP_NAME} dashboard` }, [
          h('img', { key: 'icon', src: appIconUrl(), alt: '', width: 32, height: 32 }),
          h('span', { key: 'name', className: 'application-tracker-wordmark' }, APP_NAME),
        ]),
        h('nav', { className: 'autofill-web-nav', 'aria-label': 'Extension pages' }, items.map(item => {
          const selected = item.startsWith ? active.startsWith(item.path) : active === item.path;
          const props = { key: item.path, className: 'autofill-web-link', 'aria-current': selected ? 'page' : undefined };
          const content = [h('svg', { key: 'icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: item.icon })), h('span', { key: 'label' }, item.name)];
          if (selected && item.path === '/resume-studio' && !StudioLink) return h('a', { ...props, href: '#', onClick: event => event.preventDefault() }, content);
          return link(item.path, props, content, item.path === '/resume-studio');
        })),
        h('div', { className: 'web-header-actions', 'aria-label': 'Appearance and database' },
          h(ThemeButton),
          h('button', { type: 'button', className: 'web-db-button', 'aria-label': 'Connect to DB', title: 'Connect to DB (coming soon)', disabled: true },
            h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
              h('ellipse', { cx: 12, cy: 5, rx: 8, ry: 3 }), h('path', { d: 'M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' })))),
      ),
      navigationError && h('p', { className: 'web-message web-error', role: 'alert' }, navigationError),
    );
  };
}
import { APP_NAME, appIconUrl } from './branding.js';
import { createThemeHook } from './theme.js';
import { openDashboard } from './dock.js';

