import { DRAW_ASK_EVERY, nextDrawAsk } from "@/lib/draw-prompt";
import { isUuid } from "@/lib/validation";
import {
  DRAW_ASK_AFTER_KEY,
  LEADERBOARD_OPEN_EVENT,
  LEADERBOARD_OPEN_KEY,
  MY_PHOTOS_EVENT,
  MY_PHOTOS_STORAGE_KEY,
  VOTER_STORAGE_KEY,
  VOTES_STORAGE_KEY,
} from "@/lib/votes";

function notify() {
  window.dispatchEvent(new Event("drink-votes"));
}

export function ensureVoterId(): string {
  const existing = localStorage.getItem(VOTER_STORAGE_KEY);
  if (existing && isUuid(existing)) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(VOTER_STORAGE_KEY, created);
  return created;
}

export function readVoteIds(): string[] {
  const raw = localStorage.getItem(VOTES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function replaceVoteIds(ids: string[]) {
  const next = [...new Set(ids)];
  localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(next));
  notify();
}

export function rememberVote(id: string) {
  const ids = readVoteIds();
  if (ids.includes(id)) return;
  localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify([...ids, id]));
  notify();
}

export function forgetVote(id: string) {
  const ids = readVoteIds();
  if (!ids.includes(id)) return;
  localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(ids.filter((item) => item !== id)));
  notify();
}

export function readMyPhotoIds(): string[] {
  const raw = localStorage.getItem(MY_PHOTOS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && isUuid(id)))];
  } catch {
    return [];
  }
}

export function rememberMyPhoto(id: string) {
  if (!isUuid(id)) return;
  const ids = readMyPhotoIds();
  if (ids.includes(id)) return;
  localStorage.setItem(MY_PHOTOS_STORAGE_KEY, JSON.stringify([...ids, id]));
  window.dispatchEvent(new Event(MY_PHOTOS_EVENT));
}

export function readDrawAskAfter(): number {
  const parsed = Number(localStorage.getItem(DRAW_ASK_AFTER_KEY));
  if (!Number.isInteger(parsed) || parsed < DRAW_ASK_EVERY) return DRAW_ASK_EVERY;
  return parsed;
}

/** Remembers the swipe count that should open the prompt next. Returns that count. */
export function dismissDrawAsk(swipes: number): number {
  const next = nextDrawAsk(swipes);
  localStorage.setItem(DRAW_ASK_AFTER_KEY, String(next));
  return next;
}

export function readLeaderboardOpen(): boolean {
  return localStorage.getItem(LEADERBOARD_OPEN_KEY) === "1";
}

export function writeLeaderboardOpen(open: boolean) {
  localStorage.setItem(LEADERBOARD_OPEN_KEY, open ? "1" : "0");
  window.dispatchEvent(new Event(LEADERBOARD_OPEN_EVENT));
}
