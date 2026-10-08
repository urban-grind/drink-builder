export const RACE_SIZE = 8;

export type RacePhoto = {
  id: string;
  personName: string;
  drinkName: string;
  thumbUrl: string;
};

export type RaceVote = {
  photoId: string;
  at: string;
};

/** Entries opened Wednesday, October 7, 2026 at 12:00 a.m. Eastern Time. */
export const CONTEST_OPENS_AT = Date.parse("2026-10-07T00:00:00-04:00");

export type VoteRace = {
  photos: RacePhoto[];
  votes: RaceVote[];
  from: string;
  to: string;
};

export type RaceStanding = {
  id: string;
  votes: number;
  rank: number;
};

export type RaceMoment = {
  atMs: number;
  rows: { id: string; votes: number; place: number }[];
};

export type RaceTick = {
  atMs: number;
  rows: RaceStanding[];
};

/** The on-screen clock steps in 5-second marks. Playback runs through them quickly. */
export const TICK_MS = 5000;

const RACE_DEPTH = 24;

/** Moves part of the way toward a target. The bar keeps growing instead of snapping. */
export function follow(current: number, target: number, dt: number, tau = 0.9): number {
  if (dt <= 0) return target;
  const step = 1 - Math.exp(-dt / tau);
  return current + (target - current) * step;
}

function rankCounts(counts: ReadonlyMap<string, { votes: number; reachedAt: string }>, size: number): RaceStanding[] {
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1].votes !== a[1].votes) return b[1].votes - a[1].votes;
      if (a[1].reachedAt !== b[1].reachedAt) return a[1].reachedAt < b[1].reachedAt ? -1 : 1;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .slice(0, size)
    .map(([id, row], rank) => ({ id, votes: row.votes, rank }));
}

/** Top photos at one moment. A tie keeps whoever reached that count first. */
export function standingsAt(votes: readonly RaceVote[], atMs: number, size = RACE_SIZE): RaceStanding[] {
  const counts = new Map<string, { votes: number; reachedAt: string }>();
  for (const vote of votes) {
    if (Date.parse(vote.at) > atMs) break;
    const current = counts.get(vote.photoId);
    counts.set(vote.photoId, { votes: (current?.votes ?? 0) + 1, reachedAt: vote.at });
  }

  return rankCounts(counts, size);
}

/** One step per vote. The clock sits on the 5-second mark, and the total goes up by one. */
export function raceTicks(votes: readonly RaceVote[]): RaceTick[] {
  const counts = new Map<string, { votes: number; reachedAt: string }>();
  return votes.map((vote) => {
    const current = counts.get(vote.photoId);
    counts.set(vote.photoId, { votes: (current?.votes ?? 0) + 1, reachedAt: vote.at });
    const atMs = Math.floor(Date.parse(vote.at) / TICK_MS) * TICK_MS;
    return { atMs, rows: rankCounts(counts, RACE_DEPTH) };
  });
}

/** Grows each total from the previous vote to the next, so the bar length is mid-vote instead of jumped. */
export function interpolateTicks(ticks: readonly RaceTick[], progress: number): RaceMoment {
  if (ticks.length === 0) return { atMs: 0, rows: [] };
  const clamped = Math.min(1, Math.max(0, progress));
  const step = clamped * ticks.length;
  const index = Math.min(ticks.length - 1, Math.floor(step));
  const frac = step >= ticks.length ? 1 : step - index;
  const next = ticks[index];
  const previous = new Map((index === 0 ? [] : ticks[index - 1].rows).map((row) => [row.id, row]));
  const upcoming = new Map(next.rows.map((row) => [row.id, row]));
  const rows = [...new Set([...previous.keys(), ...upcoming.keys()])].map((id) => {
    const from = previous.get(id);
    const to = upcoming.get(id);
    const fromVotes = from?.votes ?? 0;
    const toVotes = to?.votes ?? fromVotes;
    const fromPlace = from?.rank ?? (to ? to.rank + RACE_SIZE : RACE_DEPTH);
    const toPlace = to?.rank ?? (from ? from.rank + RACE_SIZE : RACE_DEPTH);
    return {
      id,
      votes: fromVotes + (toVotes - fromVotes) * frac,
      place: fromPlace + (toPlace - fromPlace) * frac,
    };
  });
  return {
    atMs: next.atMs,
    rows: rows.filter((row) => row.place < RACE_SIZE + 0.85 && row.votes > 0.02).sort((a, b) => a.place - b.place),
  };
}

export function raceMoment(votes: readonly RaceVote[], progress: number): RaceMoment {
  return interpolateTicks(raceTicks(votes), progress);
}

/** Standings at one instant. The recap moves this instant from the open to now. */
export function momentAt(votes: readonly RaceVote[], atMs: number): RaceMoment {
  return {
    atMs,
    rows: standingsAt(votes, atMs, RACE_DEPTH).map((row) => ({
      id: row.id,
      votes: row.votes,
      place: row.rank,
    })),
  };
}
