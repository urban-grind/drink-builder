const PAGES = ["vote", "leaderboard", "photo"] as const;
const CLICKS = ["share-link", "download-story", "download-post"] as const;

export type ContestPageName = (typeof PAGES)[number];
export type ContestClickName = (typeof CLICKS)[number];

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

export type ContestVisit = {
  id: number;
  at: string;
  label: string;
  personName: string | null;
};

export type ContestReport = {
  pages: ContestPageStat[];
  clicks: ContestClickStat[];
  recent: ContestVisit[];
};

const PAGE_LABELS: Record<ContestPageName, string> = {
  vote: "Vote",
  leaderboard: "Leaderboard",
  photo: "Photo pages",
};

const CLICK_LABELS: Record<ContestClickName, string> = {
  "share-link": "Share link",
  "download-story": "Download story",
  "download-post": "Download post",
};

export function emptyContestReport(): ContestReport {
  return {
    pages: PAGES.map((id) => ({ id, label: PAGE_LABELS[id], visitors: 0, visits: 0 })),
    clicks: CLICKS.map((id) => ({ id, label: CLICK_LABELS[id], count: 0 })),
    recent: [],
  };
}

export function contestPageLabel(name: string): string | null {
  if (name === "vote" || name === "leaderboard" || name === "photo") return PAGE_LABELS[name];
  return null;
}

export function contestClickLabel(name: string): string | null {
  if (name === "share-link" || name === "download-story" || name === "download-post") return CLICK_LABELS[name];
  return null;
}
