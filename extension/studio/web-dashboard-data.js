// Web Dashboard data is independent of the extension dock's view and controller.
export function applicationHistory(value = []) {
  if (!Array.isArray(value)) throw new Error('Saved application history could not be read.');
  return value.flatMap((record, index) => {
    if (!record || typeof record !== 'object') return [];
    const title = typeof record.jobTitle === 'string' ? record.jobTitle.trim() : '';
    const company = typeof record.companyName === 'string' ? record.companyName.trim() : '';
    let url = null; try { const parsed = new URL(record.jobLink); if (['http:', 'https:'].includes(parsed.protocol)) url = parsed.href; } catch {}
    if (!title && !company && !url) return [];
    const date = record.date ?? record.appliedAt, time = typeof date === 'number' ? date : Date.parse(date);
    return [{ id: `${record.id || 'application'}:${index}`, title: title || 'Untitled role', company: company || 'Company not provided', url,
      timestamp: Number.isFinite(time) && Math.abs(time) <= 864e13 ? time : null, status: typeof record.status === 'string' ? record.status.replaceAll('_', ' ') : 'Applied' }];
  }).sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
}
export function applicationMetrics(records, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()), week = new Date(day), month = new Date(now.getFullYear(), now.getMonth(), 1);
  week.setDate(week.getDate() - (week.getDay() + 6) % 7);
  const count = start => records.filter(record => record.timestamp !== null && record.timestamp >= start.getTime() && record.timestamp <= now.getTime()).length;
  return { today: count(day), week: count(week), month: count(month), total: records.length };
}
export function applicationSeries(records, days = 30, now = new Date()) {
  if (![7, 30, 90].includes(days)) throw new Error('Choose a supported chart range.');
  const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate()); first.setDate(first.getDate() - days + 1);
  const counts = new Map(); for (let index = 0; index < days; index++) { const date = new Date(first); date.setDate(date.getDate() + index); counts.set(key(date), 0); }
  for (const record of records) { if (record.timestamp === null || record.timestamp > now.getTime()) continue; const date = key(new Date(record.timestamp)); if (counts.has(date)) counts.set(date, counts.get(date) + 1); }
  return [...counts].map(([date, count]) => ({ date, count }));
}
export function currentWebTab(tabs) {
  const eligible = tabs.filter(tab => { try { return Number.isSafeInteger(tab.id) && ['http:', 'https:'].includes(new URL(tab.url).protocol); } catch { return false; } });
  return eligible.find(tab => tab.active) || eligible.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
}
export async function readDashboard(browser = globalThis.chrome) {
  const saved = await browser.storage.local.get(['appliedList', 'dailyGoal']);
  const goal = Number(saved.dailyGoal);
  return { records: applicationHistory(saved.appliedList), goal: Number.isSafeInteger(goal) && goal > 0 && goal <= 999 ? goal : null };
}
export async function saveDailyGoal(value, browser = globalThis.chrome) {
  const goal = Number(value); if (!Number.isSafeInteger(goal) || goal < 1 || goal > 999) throw new Error('Enter a whole-number goal from 1 to 999.');
  await browser.storage.local.set({ dailyGoal: goal }); return goal;
}
export async function captureDashboardJob(tab, browser = globalThis.chrome) {
  if (!tab) throw new Error('Open a job listing before capturing it.');
  await browser.tabs.update(tab.id, { active: true });
  const response = await browser.runtime.sendMessage({ version: 1, requestId: crypto.randomUUID(), operation: 'CAPTURE_COMMAND', payload: { command: 'capture-job', sourceTabId: tab.id } });
  if (!response?.ok || !response.result?.captureId) throw new Error(response?.error?.message || 'This job could not be captured. Review it in Resume Studio.');
}
