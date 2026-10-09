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

export type DrinkTotal = {
  name: string;
  quantity: number;
  /** This drink's share of every drink sold in the same list, from 0 to 100. */
  share: number;
  imageUrl: string | null;
  description: string | null;
  orderUrl: string | null;
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
 * Sales the rankings are built from. Square is polled every 10 minutes.
 * The pull starts at `drinkStatsRangeStart` so a week that begins last month is included.
 */
export async function loadDrinkSales(now = new Date()): Promise<DrinkSale[]> {
  if (!drinkStatsEnabled()) return [];
  const { loadCachedSquareSales, startSquarePoll } = await import("@/lib/square-drinks");
  startSquarePoll(() => drinkStatsRangeStart());
  return loadCachedSquareSales(drinkStatsRangeStart(now));
}

/** Earliest Eastern midnight the day, week, and month boards can need. */
export function drinkStatsRangeStart(now = new Date()): string {
  const date = easternDate(now);
  const week = shiftDays(date, -daysFromMonday(now));
  const month = { year: date.year, month: date.month, day: 1 };
  const start = earlier(easternMidnight(week), easternMidnight(month));
  return start.toISOString();
}

export function rankDrinkSales(sales: readonly DrinkSale[], now = new Date()): DrinkStats {
  const rows = sales.flatMap((sale) => {
    const name = sale.name.trim();
    const soldAt = new Date(sale.soldAt);
    if (!name || !Number.isFinite(sale.quantity) || sale.quantity === 0 || Number.isNaN(soldAt.getTime())) return [];
    return [{ name, key: name.toLocaleLowerCase(), quantity: sale.quantity, soldAt, imageUrl: sale.imageUrl, description: sale.description, orderUrl: sale.orderUrl }];
  });
  const monthRows = rows.filter((row) => sameMonth(row.soldAt, now));
  return {
    drinks: board(rows),
    day: board(rows.filter((row) => sameDay(row.soldAt, now))),
    week: board(rows.filter((row) => sameWeek(row.soldAt, now))),
    month: board(monthRows),
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
    .map((row) => ({ name: row.name, quantity: row.quantity, share: 0, imageUrl: row.imageUrl, description: row.description, orderUrl: row.orderUrl }))
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

function easternMidnight(date: EasternDate): Date {
  const guess = new Date(Date.UTC(date.year, date.month - 1, date.day));
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

function earlier(left: Date, right: Date): Date {
  return left < right ? left : right;
}
