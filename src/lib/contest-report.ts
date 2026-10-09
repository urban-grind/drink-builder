const PAGES = ["vote", "leaderboard", "photo", "popular"] as const;
const CLICKS = [
  "share-link",
  "download-story",
  "download-post",
  "popular-today",
  "popular-week",
  "popular-month",
  "popular-drink",
  "popular-order",
] as const;
const MAX_DRINK_NAME = 80;

export type ContestPageName = (typeof PAGES)[number];
export type ContestClickName = (typeof CLICKS)[number];

const DRINK_CLICKS = new Set<ContestClickName>(["popular-drink", "popular-order"]);

export type ContestPageStat = {
  id: ContestPageName;
  label: string;
  visitors: number;
  visits: number;
};

export type ContestClickStat = {
  id: ContestClickName;
  label: string;
  count: number;
};

export type ContestDrinkStat = {
  name: string;
  opens: number;
  orders: number;
};

export type ContestVisit = {
  id: number;
  at: string;
  label: string;
  personName: string | null;
};

export type ContestReport = {
  pages: ContestPageStat[];
  clicks: ContestClickStat[];
  drinks: ContestDrinkStat[];
  recent: ContestVisit[];
};

const PAGE_LABELS: Record<ContestPageName, string> = {
  vote: "Vote",
  leaderboard: "Leaderboard",
  photo: "Photo pages",
  popular: "Popular",
};

const CLICK_LABELS: Record<ContestClickName, string> = {
  "share-link": "Share link",
  "download-story": "Download story",
  "download-post": "Download post",
  "popular-today": "Today",
  "popular-week": "This week",
  "popular-month": "This month",
  "popular-drink": "Opened a drink",
  "popular-order": "Order",
};

export function emptyContestReport(): ContestReport {
  return {
    pages: PAGES.map((id) => ({ id, label: PAGE_LABELS[id], visitors: 0, visits: 0 })),
    clicks: CLICKS.map((id) => ({ id, label: CLICK_LABELS[id], count: 0 })),
    drinks: [],
    recent: [],
  };
}

function isPage(name: string): name is ContestPageName {
  return (PAGES as readonly string[]).includes(name);
}

function isClick(name: string): name is ContestClickName {
  return (CLICKS as readonly string[]).includes(name);
}

/** Click name for opening a drink or tapping Order, with the drink kept for the review page. */
export function popularDrinkClick(action: "popular-drink" | "popular-order", drinkName: string): string {
  return `${action}:${drinkName.trim().slice(0, MAX_DRINK_NAME)}`;
}

export function parseContestClick(name: string): { id: ContestClickName; drink: string | null } | null {
  if (isClick(name)) return { id: name, drink: null };
  const split = name.indexOf(":");
  if (split < 1) return null;
  const id = name.slice(0, split);
  if (!isClick(id) || !DRINK_CLICKS.has(id)) return null;
  const drink = name.slice(split + 1).trim();
  if (drink.length === 0 || drink.length > MAX_DRINK_NAME || /[\u0000-\u001f]/.test(drink)) return null;
  return { id, drink };
}

export function contestPageLabel(name: string): string | null {
  return isPage(name) ? PAGE_LABELS[name] : null;
}

export function contestClickLabel(name: string): string | null {
  const parsed = parseContestClick(name);
  if (!parsed) return null;
  const label = CLICK_LABELS[parsed.id];
  return parsed.drink ? `${label} · ${parsed.drink}` : label;
}
