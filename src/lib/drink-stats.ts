const EASTERN = "America/Toronto";
const FLAG = "DRINK_STATS";

/** How many drinks each board shows. */
export const DRINK_BOARD_SIZE = 10;

export type DrinkSale = {
  name: string;
  quantity: number;
  soldAt: string;
  imageUrl?: string;
  description?: string;
  orderUrl?: string;
};

export type DrinkBadge = {
  tone: "up" | "new" | "streak";
  label: string;
};

export type DrinkTotal = {
  name: string;
  quantity: number;
  /** This drink's share of every drink sold in the same list, from 0 to 100. */
  share: number;
  imageUrl: string | null;
  description: string | null;
  orderUrl: string | null;
  /** Rank change against the same stretch of time before, plus a weekly winning streak. */
  badges: DrinkBadge[];
};

export type DrinkStats = {
  /** Top drinks in the sales that were loaded, most sold first. */
  drinks: DrinkTotal[];
  day: DrinkTotal[];
  week: DrinkTotal[];
  month: DrinkTotal[];
};

type EasternDate = { year: number; month: number; day: number };

/**
 * On only when DRINK_STATS is 1, true, or yes.
 * Unset, empty, or anything else hides the page and the menu link.
 */
export function drinkStatsEnabled(): boolean {
  const value = process.env[FLAG]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Sales the rankings are built from. Square is polled every 30 minutes.
 * The pull starts at the previous month so each list can be compared with the same stretch of time before it.
 */
export async function loadDrinkSales(now = new Date()): Promise<{ sales: DrinkSale[]; updatedAt: number | null }> {
  if (!drinkStatsEnabled()) return { sales: [], updatedAt: null };
  const { loadCachedSquareSales, squareSalesUpdatedAt, startSquarePoll } = await import("@/lib/square-drinks");
  startSquarePoll(() => drinkStatsRangeStart());
  const sales = await loadCachedSquareSales(drinkStatsRangeStart(now));
  return { sales, updatedAt: squareSalesUpdatedAt() };
}

/** How long ago the café list was pulled, without a sales count. */
export function drinkUpdatedLabel(updatedAt: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - updatedAt) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes === 1) return "Updated 1 minute ago";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Updated 1 hour ago";
  return `Updated ${hours} hours ago`;
}

/** Eastern midnight on the 1st, two months back, so a three-month run is inside the pull. */
export function drinkStatsRangeStart(now = new Date()): string {
  const date = easternDate(now);
  return easternAt(shiftMonths(date, -2)).toISOString();
}

export function rankDrinkSales(sales: readonly DrinkSale[], now = new Date()): DrinkStats {
  const rows = sales.flatMap((sale) => {
    const name = sale.name.trim();
    const soldAt = new Date(sale.soldAt);
    if (!name || !Number.isFinite(sale.quantity) || sale.quantity === 0 || Number.isNaN(soldAt.getTime())) return [];
    return [{ name, key: name.toLocaleLowerCase(), quantity: sale.quantity, soldAt, imageUrl: sale.imageUrl, description: sale.description, orderUrl: sale.orderUrl }];
  });
  const dayRows = rows.filter((row) => sameDay(row.soldAt, now));
  const weekRows = rows.filter((row) => sameWeek(row.soldAt, now));
  const monthRows = rows.filter((row) => sameMonth(row.soldAt, now));
  return {
    drinks: board(rows),
    day: withMovement(board(dayRows), dayRows, rows.filter((row) => inYesterdaySoFar(row.soldAt, now)), runningStreak(rows, now, "day")),
    week: withMovement(board(weekRows), weekRows, rows.filter((row) => inPreviousWeekSoFar(row.soldAt, now)), runningStreak(rows, now, "week")),
    month: withMovement(board(monthRows), monthRows, rows.filter((row) => inPreviousMonthSoFar(row.soldAt, now)), runningStreak(rows, now, "month")),
  };
}

/** Whole percent. A real sale under half a percent stays visible as under 1. */
export function drinkShareLabel(share: number): string {
  if (share > 0 && share < 0.5) return "<1%";
  return `${Math.round(share)}%`;
}

function board(rows: SaleRow[]): DrinkTotal[] {
  const ranked = totals(rows);
  const sold = ranked.reduce((sum, row) => sum + row.quantity, 0);
  return ranked.slice(0, DRINK_BOARD_SIZE).map((row) => ({
    ...row,
    share: sold > 0 ? (row.quantity / sold) * 100 : 0,
  }));
}

type SaleRow = { name: string; key: string; quantity: number; imageUrl?: string; description?: string; orderUrl?: string };

function totals(rows: SaleRow[]): DrinkTotal[] {
  const grouped = new Map<string, { name: string; nameQty: number; quantity: number; imageUrl: string | null; description: string | null; orderUrl: string | null }>();
  for (const row of rows) {
    const imageUrl = row.imageUrl || null;
    const description = row.description?.trim() || null;
    const orderUrl = row.orderUrl || null;
    const current = grouped.get(row.key);
    if (!current) {
      grouped.set(row.key, { name: row.name, nameQty: row.quantity, quantity: row.quantity, imageUrl, description, orderUrl });
      continue;
    }
    current.quantity += row.quantity;
    if (!current.imageUrl && imageUrl) current.imageUrl = imageUrl;
    if (!current.description && description) current.description = description;
    if (!current.orderUrl && orderUrl) current.orderUrl = orderUrl;
    if (row.quantity > current.nameQty) {
      current.name = row.name;
      current.nameQty = row.quantity;
      if (imageUrl) current.imageUrl = imageUrl;
      if (description) current.description = description;
      if (orderUrl) current.orderUrl = orderUrl;
    }
  }
  return [...grouped.values()]
    .map((row) => ({ name: row.name, quantity: row.quantity, share: 0, imageUrl: row.imageUrl, description: row.description, orderUrl: row.orderUrl, badges: [] }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

function sameDay(sale: Date, now: Date): boolean {
  return dateKey(easternDate(sale)) === dateKey(easternDate(now));
}

function sameWeek(sale: Date, now: Date): boolean {
  const saleMonday = shiftDays(easternDate(sale), -daysFromMonday(sale));
  const nowMonday = shiftDays(easternDate(now), -daysFromMonday(now));
  return dateKey(saleMonday) === dateKey(nowMonday);
}

function sameMonth(sale: Date, now: Date): boolean {
  const left = easternDate(sale);
  const right = easternDate(now);
  return left.year === right.year && left.month === right.month;
}

function easternDate(instant: Date): EasternDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function daysFromMonday(instant: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short" }).format(instant);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return index < 0 ? 0 : index;
}

function dateKey(date: EasternDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function shiftDays(date: EasternDate, days: number): EasternDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function easternAt(date: EasternDate, hour = 0, minute = 0, second = 0): Date {
  const guess = new Date(Date.UTC(date.year, date.month - 1, date.day, hour, minute, second));
  return new Date(guess.getTime() - easternOffsetMs(guess));
}

function easternOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), hour, pick("minute"), pick("second"));
  return asUtc - instant.getTime();
}

type TimedRow = SaleRow & { soldAt: Date };
type RunUnit = "day" | "week" | "month";
type Run = { key: string; count: number; unit: RunUnit };

function withMovement(current: DrinkTotal[], currentRows: TimedRow[], previousRows: TimedRow[], run: Run | null): DrinkTotal[] {
  const previousHadSales = previousRows.some((row) => row.quantity > 0);
  const previousTop = new Set(board(previousRows).map((drink) => drink.name.toLocaleLowerCase()));
  const currentRanks = competitionRanks(currentRows);
  const previousRanks = competitionRanks(previousRows);
  return current.map((drink) => {
    const key = drink.name.toLocaleLowerCase();
    const badges: DrinkBadge[] = [];
    const move = previousHadSales ? spotBadge(currentRanks.get(key), previousRanks.get(key), previousTop.has(key)) : null;
    if (move) badges.push(move);
    const streak = streakBadge(run, key);
    if (streak) badges.push(streak);
    return { ...drink, badges };
  });
}

/** How long the current leader of this list has held first. Earlier days, weeks, and months count in full. */
function runningStreak(rows: TimedRow[], now: Date, unit: RunUnit): Run | null {
  const limit = unit === "day" ? 100 : unit === "week" ? 16 : 6;
  let key: string | null = null;
  let count = 0;
  for (let back = 0; back < limit; back += 1) {
    const when = shiftUnit(now, unit, -back);
    const leader = board(rows.filter((row) => inUnit(row.soldAt, when, unit)))[0];
    if (!leader) break;
    const leaderKey = leader.name.toLocaleLowerCase();
    if (key != null && leaderKey !== key) break;
    key = leaderKey;
    count += 1;
  }
  if (!key || count < 2) return null;
  return { key, count, unit };
}

function streakBadge(run: Run | null, key: string): DrinkBadge | null {
  if (!run || run.key !== key) return null;
  const noun = run.unit === "day" ? "days" : run.unit === "week" ? "weeks" : "months";
  return { tone: "streak", label: `${run.count} ${noun} running` };
}

function shiftUnit(now: Date, unit: RunUnit, steps: number): Date {
  if (unit === "month") return easternAt(shiftMonths(easternDate(now), steps));
  return shiftEasternDays(now, unit === "week" ? steps * 7 : steps);
}

function inUnit(sale: Date, when: Date, unit: RunUnit): boolean {
  if (unit === "day") return sameDay(sale, when);
  if (unit === "week") return sameWeek(sale, when);
  return sameMonth(sale, when);
}

function shiftMonths(date: EasternDate, months: number): EasternDate {
  const index = date.year * 12 + (date.month - 1) + months;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1, day: 1 };
}

function competitionRanks(rows: TimedRow[]): Map<string, number> {
  const ranked = totals(rows);
  const ranks = new Map<string, number>();
  let rank = 0;
  let lastQuantity = Number.POSITIVE_INFINITY;
  ranked.forEach((drink, index) => {
    if (drink.quantity !== lastQuantity) {
      rank = index + 1;
      lastQuantity = drink.quantity;
    }
    ranks.set(drink.name.toLocaleLowerCase(), rank);
  });
  return ranks;
}

function placeName(rank: number): string {
  const mod10 = rank % 10;
  const mod100 = rank % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
  return `${rank}${suffix} place`;
}

function spotBadge(current: number | undefined, previous: number | undefined, onPreviousBoard: boolean): DrinkBadge | null {
  if (current == null || !onPreviousBoard || previous == null) return { tone: "new", label: current == null ? "New to the top 10" : `New to ${placeName(current)}` };
  const delta = previous - current;
  if (delta < 2) return null;
  return { tone: "up", label: `↑ ${delta} spots` };
}

function inYesterdaySoFar(sale: Date, now: Date): boolean {
  return dateKey(easternDate(sale)) === dateKey(shiftDays(easternDate(now), -1)) && clockAtOrBefore(sale, now);
}

function inPreviousWeekSoFar(sale: Date, now: Date): boolean {
  const then = shiftEasternDays(now, -7);
  return sameWeek(sale, then) && sale.getTime() <= then.getTime();
}

function inPreviousMonthSoFar(sale: Date, now: Date): boolean {
  const today = easternDate(now);
  const previous = today.month === 1 ? { year: today.year - 1, month: 12 } : { year: today.year, month: today.month - 1 };
  const sold = easternDate(sale);
  if (sold.year !== previous.year || sold.month !== previous.month) return false;
  const capDay = Math.min(today.day, daysInMonth(previous.year, previous.month));
  if (sold.day < capDay) return true;
  if (sold.day > capDay) return false;
  return clockAtOrBefore(sale, now);
}

function clockAtOrBefore(sale: Date, now: Date): boolean {
  return clockSeconds(sale) <= clockSeconds(now);
}

function clockSeconds(instant: Date): number {
  const clock = easternClock(instant);
  return clock.hour * 3600 + clock.minute * 60 + clock.second;
}

function shiftEasternDays(instant: Date, days: number): Date {
  const clock = easternClock(instant);
  return easternAt(shiftDays(clock, days), clock.hour, clock.minute, clock.second);
}

function easternClock(instant: Date): EasternDate & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour, minute: pick("minute"), second: pick("second") };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
