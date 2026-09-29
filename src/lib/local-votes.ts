import { isUuid } from "@/lib/validation";
import { VOTER_STORAGE_KEY, VOTES_STORAGE_KEY } from "@/lib/votes";

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
