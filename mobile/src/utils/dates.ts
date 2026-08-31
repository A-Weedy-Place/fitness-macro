/**
 * A diary date is a calendar date, not a UTC timestamp.  Calling
 * `toISOString()` here made a Pakistan evening look like the previous day.
 * Keep the device zone by default, with an optional IANA-zone override from
 * the account settings.
 */
export function today(timeZone?: string): string {
  return dateFor(new Date(), timeZone);
}

export function dateFor(value: Date, timeZone?: string): string {
  if (timeZone && timeZone !== 'device') {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
      const part = (type: string) => parts.find((item) => item.type === type)?.value;
      const year = part('year'); const month = part('month'); const day = part('day');
      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // A stale or invalid override must never prevent local food logging.
    }
  }
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Device time'; } catch { return 'Device time'; }
}

export function isSupportedTimeZone(value: string): boolean {
  if (!value || value === 'device') return true;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; } catch { return false; }
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function startOfWeekMonday(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function dateDistance(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000);
}
