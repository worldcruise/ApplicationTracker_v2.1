export const DASHBOARD_OPERATIONS = new Set(['DASHBOARD_STATE', 'DASHBOARD_SELECT_PROFILE', ...DOCK_RECORD_OPERATIONS, ...DOCK_APPLY_OPERATIONS]);
import { DOCK_RECORD_OPERATIONS } from './dock-records-service.js';
import { DOCK_APPLY_OPERATIONS } from './dock-apply-service.js';

export function isReferenceDashboardSender(sender, browser = globalThis.chrome) {
  try {
    const url = new URL(sender.url), base = new URL(browser.runtime.getURL('dashboard.html'));
    return sender.id === browser.runtime.id && (sender.frameId ?? 0) === 0 && url.protocol === base.protocol && url.host === base.host &&
      url.pathname === base.pathname;
  } catch { return false; }
}
