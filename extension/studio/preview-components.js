import { wr as requireReact } from '../chunks/globals-BIOuRv6A.js';
import { openStudioPreview } from './dock.js';

const React = requireReact();
const h = React.createElement;

export function StudioPreviewLink({ className, children }) {
  const [windowId, setWindowId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    chrome.windows.getCurrent().then(window => { if (active) setWindowId(window.id); })
      .catch(() => { if (active) setError('Reload this page to find its Chrome window.'); });
    return () => { active = false; };
  }, []);
  function open() {
    setBusy(true); setError('');
    openStudioPreview(windowId).catch(cause => setError(cause.message)).finally(() => setBusy(false));
  }
  return h('span', null,
    h('button', { type: 'button', className, disabled: windowId === null || busy, onClick: open, title: 'Open Resume Studio document preview', 'aria-busy': busy }, children),
    error && h('span', { role: 'alert', className: 'studio-preview-link-error' }, error),
  );
}

// Legacy Studio URLs lead to the preview page with its embedded editor.
export function ResumeStudioPage() {
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    chrome.windows.getCurrent().then(window => openStudioPreview(window.id))
      .catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, []);
  return h('p', { role: error ? 'alert' : 'status' }, error || 'Opening Resume Studio preview…');
}
