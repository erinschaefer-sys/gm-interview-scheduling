// Wall-clock formatting for case times. Everything here is plain string and
// calendar arithmetic, never a Date in the browser's zone, so a laptop set to
// Pacific still shows the Eastern times the candidate was emailed (brief §8).

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

export function toMinutes(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function dateParts(date: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function clock(time: string): { hm: string; meridiem: 'AM' | 'PM' } {
  const minutes = toMinutes(time);
  const h24 = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hm: `${h12}:${mm}`, meridiem: h24 < 12 ? 'AM' : 'PM' };
}

/** "13:00" → "1:00 PM" */
export function formatTime(time: string): string {
  const { hm, meridiem } = clock(time);
  return `${hm} ${meridiem}`;
}

/** "09:00","09:45" → "9:00 – 9:45 AM"; "11:30","12:15" → "11:30 AM – 12:15 PM" */
export function formatTimeRange(start: string, end: string, separator = ' – '): string {
  const a = clock(start);
  const b = clock(end);
  if (a.meridiem === b.meridiem) return `${a.hm}${separator}${b.hm} ${b.meridiem}`;
  return `${a.hm} ${a.meridiem}${separator}${b.hm} ${b.meridiem}`;
}

/**
 * Weekday of a calendar date. A YYYY-MM-DD date names the same weekday in
 * every zone, so computing it on the UTC calendar gives the case-timezone
 * weekday without ever consulting the browser's zone.
 */
export function weekdayIndex(date: string): number {
  const { y, m, d } = dateParts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2026-10-28" → "Wed, Oct 28" */
export function formatDateShort(date: string): string {
  const { m, d } = dateParts(date);
  return `${WEEKDAYS_SHORT[weekdayIndex(date)]}, ${MONTHS_SHORT[m - 1]} ${d}`;
}

/** "2026-10-28" → "Wednesday, October 28, 2026" */
export function formatDateLong(date: string): string {
  const { y, m, d } = dateParts(date);
  return `${WEEKDAYS_LONG[weekdayIndex(date)]}, ${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

/** "2026-10-28" → "Wed Oct 28, 2026" (the confirmation_text format, brief §5) */
export function formatDateReference(date: string): string {
  const { y, m, d } = dateParts(date);
  return `${WEEKDAYS_SHORT[weekdayIndex(date)]} ${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

/**
 * Generic zone name for the case timezone, e.g. "Eastern Time" for
 * America/Detroit. Resolved for the case's zone, not the browser's.
 */
export function timeZoneLabel(timeZone: string, onDate?: string): string {
  try {
    const ref = onDate && isDate(onDate)
      ? (() => { const { y, m, d } = dateParts(onDate); return new Date(Date.UTC(y, m - 1, d, 12)); })()
      : new Date();
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(ref)
      .find((p) => p.type === 'timeZoneName');
    if (part?.value) return part.value;
  } catch {
    // Unknown zone id: fall through to the raw id rather than guessing.
  }
  return timeZone;
}

/** "Eastern Time" → "Eastern" (used inside confirmation_text) */
export function timeZoneShortLabel(timeZone: string, onDate?: string): string {
  return timeZoneLabel(timeZone, onDate).replace(/ Time$/, '');
}
