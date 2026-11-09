export const PROMPT_SETTINGS_OPERATIONS = new Set(['PROMPT_SETTINGS', 'PROMPT_SAVE', 'PROMPT_SELECT', 'CANDIDATE_GET', 'CANDIDATE_SAVE']);

export function isPromptSettingsSender(sender, browser = globalThis.chrome) {
  try {
    const url = new URL(sender.url), base = new URL(browser.runtime.getURL('options.html'));
    return sender.id === browser.runtime.id && (sender.frameId ?? 0) === 0 && url.protocol === base.protocol && url.host === base.host && url.pathname === base.pathname && url.hash.split('?')[0] === '#/settings/prompts';
  } catch { return false; }
}
