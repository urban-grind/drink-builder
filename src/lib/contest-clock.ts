/** Voting closes Friday, October 23, 2026 at 11:59 p.m. Eastern Time. */
export const VOTING_CLOSES_AT = Date.parse("2026-10-23T23:59:00-04:00");

export type ContestTimeLeft = {
  closed: boolean;
  days: number;
  hours: number;
  minutes: number;
};

export function contestTimeLeft(now: number, closesAt = VOTING_CLOSES_AT): ContestTimeLeft {
  const remaining = closesAt - now;
  if (remaining <= 0) return { closed: true, days: 0, hours: 0, minutes: 0 };
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    closed: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
  };
}

/** The line beside the photo contest and the swipe draw. */
export function contestDaysLeftLabel(left: ContestTimeLeft): string {
  if (left.closed) return "Closed";
  if (left.days <= 0) return "Ends today";
  return `${left.days} ${left.days === 1 ? "day" : "days"} left`;
}

export function contestClockLabel(left: ContestTimeLeft): string {
  if (left.closed) return "Voting has closed";
  const days = `${left.days} ${left.days === 1 ? "day" : "days"}`;
  const hours = `${left.hours} ${left.hours === 1 ? "hour" : "hours"}`;
  const minutes = `${left.minutes} ${left.minutes === 1 ? "minute" : "minutes"}`;
  return `${days}, ${hours}, ${minutes}`;
}
