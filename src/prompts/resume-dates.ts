const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Presentation only: preserve source dates and avoid timezone-dependent parsing.
export function formatResumeDate(value: string) {
  const date = value.trim(), match = /^(\d{4})-(0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/.exec(date);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : date;
}

export function formatResumePeriod(entry: { startDate: string; endDate: string; current?: boolean } | undefined, stacked = false) {
  if (!entry) return "";
  const start = formatResumeDate(entry.startDate), end = entry.current ? "Present" : formatResumeDate(entry.endDate);
  return [start, end].filter(Boolean).join(stacked ? "\n" : " - ");
}
