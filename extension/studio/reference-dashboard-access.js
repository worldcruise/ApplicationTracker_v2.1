export const DASHBOARD_OPERATIONS = new Set(['DASHBOARD_STATE', ...DOCK_RECORD_OPERATIONS, ...DOCK_APPLY_OPERATIONS]);
import { DOCK_RECORD_OPERATIONS } from './dock-records-service.js';
import { DOCK_APPLY_OPERATIONS } from './dock-apply-service.js';

export function isNativeDockSender(sender, browser = globalThis.chrome) {
  try {
    const url = new URL(sender.url), base = new URL(browser.runtime.getURL('sidepanel.html'));
    return sender.id === browser.runtime.id && (sender.frameId ?? 0) === 0 && url.protocol === base.protocol && url.host === base.host &&
      url.pathname === base.pathname;
  } catch { return false; }
}

// Web pages share the queue editor, but do not acquire dock-only Apply or
// profile-selection operations.
export const WEB_RECORD_OPERATIONS = new Set(DOCK_RECORD_OPERATIONS);
export function isWorkspaceRecordsSender(sender,browser=globalThis.chrome){
  try {
    const url=new URL(sender.url),base=new URL(browser.runtime.getURL('options.html'));
    return sender.id===browser.runtime.id&&(sender.frameId??0)===0&&url.protocol===base.protocol&&url.host===base.host&&url.pathname===base.pathname;
  } catch { return false; }
}

// A submitted document opens in a separate, read-only Studio view. It never
// receives the editor's ownership or mutation permissions.
export function isSubmittedPreviewSender(sender,browser=globalThis.chrome){
  try {
    const url=new URL(sender.url),base=new URL(browser.runtime.getURL('preview.html'));
    return sender.id===browser.runtime.id&&(sender.frameId??0)===0&&url.protocol===base.protocol&&url.host===base.host&&url.pathname===base.pathname&&
      [...url.searchParams.keys()].every(key=>['submitted','kind'].includes(key))&&url.searchParams.getAll('submitted').length===1&&url.searchParams.get('submitted').length>0&&url.searchParams.get('submitted').length<=300&&
      url.searchParams.getAll('kind').length===1&&['resume','letter'].includes(url.searchParams.get('kind'));
  } catch { return false; }
}
