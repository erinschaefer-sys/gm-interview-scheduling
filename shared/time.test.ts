import { describe, expect, it } from 'vitest';
import { formatDateLong, formatDateReference, formatDateShort, formatTime, formatTimeRange, isDate, isTime, timeZoneLabel, timeZoneShortLabel, weekdayIndex } from './time';

describe('time formatting (plain string parsing)', () => {
  it('formats 24h wall-clock strings', () => {
    expect(formatTime('13:00')).toBe('1:00 PM');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('09:45')).toBe('9:45 AM');
  });

  it('formats ranges, sharing the meridiem when it matches', () => {
    expect(formatTimeRange('09:00', '09:45')).toBe('9:00 – 9:45 AM');
    expect(formatTimeRange('11:30', '12:15')).toBe('11:30 AM – 12:15 PM');
    expect(formatTimeRange('09:00', '09:45', '-')).toBe('9:00-9:45 AM');
  });

  it('derives weekday and dates from the calendar date', () => {
    expect(weekdayIndex('2026-10-27')).toBe(2);
    expect(formatDateShort('2026-10-28')).toBe('Wed, Oct 28');
    expect(formatDateLong('2026-10-29')).toBe('Thursday, October 29, 2026');
    expect(formatDateReference('2026-10-28')).toBe('Wed Oct 28, 2026');
  });

  it('labels the case zone generically', () => {
    expect(timeZoneLabel('America/Detroit', '2026-10-28')).toBe('Eastern Time');
    expect(timeZoneShortLabel('America/Detroit', '2026-10-28')).toBe('Eastern');
    expect(timeZoneLabel('Not/AZone')).toBe('Not/AZone');
  });

  it('validates formats', () => {
    expect(isTime('9:00')).toBe(false);
    expect(isTime('24:00')).toBe(false);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-10-28')).toBe(true);
  });
});
