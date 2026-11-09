function timestamp(value) {
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) && Math.abs(time) <= 864e13 ? time : null;
}
export function safeJobUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function referenceDashboardData(saved = {}, session = {}, now = new Date(), candidateId = null) {
  if (saved.appliedList !== undefined && !Array.isArray(saved.appliedList)) throw new Error('Saved application history could not be read.');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), end = now.getTime();
  const today = value => value !== null && value >= start && value <= end;
  const activity = (saved.appliedList || []).flatMap((record, index) => {
    if (!record || typeof record !== 'object') return [];
    const title = String(record.jobTitle || record.title || '').trim(), company = String(record.companyName || record.company || '').trim(), url = safeJobUrl(record.jobLink || record.url);
    if (!title && !company && !url) return [];
    return [{ id: String(record.id || index), title: title || 'Untitled role', company: company || 'Company not provided', url, timestamp: timestamp(record.date ?? record.appliedAt) }];
  }).sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  const exports = Object.entries(session).filter(([key, ticket]) => key.startsWith('pdf-export:') && ticket && (!candidateId || ticket.candidateId === candidateId) && today(timestamp(ticket.createdAt)) && ticket.files?.some(file => file.kind === 'cv' && file.state === 'complete'));
  return { applications: activity.filter(record => today(record.timestamp)).length, resumes: exports.length, activity: activity.slice(0, 6) };
}
export function activityTime(value, now = Date.now()) {
  if (value === null) return 'Date unavailable';
  const hours = Math.max(0, Math.floor((now - value) / 3600000));
  if (!hours) return 'less than an hour ago';
  if (hours < 24) return `about ${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(value);
}
