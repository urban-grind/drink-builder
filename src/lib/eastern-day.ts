const EASTERN = "America/Toronto";

/** How many Eastern midnights a photo has been up, counting today as one. */
export function easternDaySpan(from: Date, to: Date): number {
  const start = easternDayIndex(from);
  const end = easternDayIndex(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, end - start + 1);
}

function easternDayIndex(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(pick("year"), pick("month") - 1, pick("day")) / 86_400_000;
}

/** Midnight-to-midnight Eastern, as UTC instants. Contest dates use this clock. */
export function easternDayRange(now = new Date()): { start: string; end: string } {
  const start = zonedMidnight(now, EASTERN);
  const end = zonedMidnight(new Date(start.getTime() + 36 * 60 * 60 * 1000), EASTERN);
  return { start: start.toISOString(), end: end.toISOString() };
}

function zonedMidnight(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  let hour = pick("hour");
  const minute = pick("minute");
  const second = pick("second");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = asUtc - now.getTime();
  return new Date(Date.UTC(year, month - 1, day) - offset);
}
