export const APP_NAME = 'Application Tracker 2.1';
export const APP_ICON = 'icons/icon.png';

export function appIconUrl(browser = globalThis.chrome) {
  return browser?.runtime?.getURL(APP_ICON) || APP_ICON;
}
