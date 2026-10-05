/** Entries close Monday, October 19, 2026 at 12:00 a.m. Eastern Time. */
export const ENTRY_CLOSE_AT = Date.parse("2026-10-19T00:00:00-04:00");

export type EntryTimeLeft = {
  closed: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function entryTimeLeft(now: number, closeAt = ENTRY_CLOSE_AT): EntryTimeLeft {
  const remaining = closeAt - now;
  if (remaining <= 0) return { closed: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    closed: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function entryCountdownLabel(left: EntryTimeLeft): string {
  if (left.closed) return "Entries are closed";
  return `Accepting entries for ${count(left.days, "day")}, ${count(left.hours, "hour")}, ${count(left.minutes, "minute")}, ${count(left.seconds, "second")}`;
}

function count(value: number, word: string): string {
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}
