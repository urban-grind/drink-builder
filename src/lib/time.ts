export function formatWhen(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) return "Just now";
  if (delta < hour) {
    const minutes = Math.floor(delta / minute);
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  if (delta < day) {
    const hours = Math.floor(delta / hour);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (delta < 7 * day) {
    const days = Math.floor(delta / day);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
