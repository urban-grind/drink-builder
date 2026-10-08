function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

/** The line across the top of the owner's photo. The gap is the part that matters. */
export function ownerStandingBanner(input: {
  live: boolean;
  voteCount: number;
  rank: number | null;
  votesFromFirst: number | null;
}): string {
  if (!input.live) return "Waiting for approval. You can still share your link.";
  if (input.voteCount === 0 || input.rank == null) return "This is your personalized voting link.";
  if (input.rank === 1) return "In first place";
  if (input.votesFromFirst != null) {
    const gap = input.votesFromFirst;
    return `${gap} ${gap === 1 ? "vote" : "votes"} from the top place`;
  }
  return ordinal(input.rank);
}

/** Vote count and place, without the gap. The banner carries the gap. */
export function ownerPlaceLine(input: { live: boolean; voteCount: number; rank: number | null }): string | null {
  if (!input.live || input.voteCount === 0 || input.rank == null) return null;
  const votes = `${input.voteCount} ${input.voteCount === 1 ? "vote" : "votes"}`;
  return `${votes} · ${ordinal(input.rank)}`;
}

/** Votes, place, and the gap to first place. A new entry has no rank yet. */
export function ownerStandingLine(input: {
  live: boolean;
  voteCount: number;
  rank: number | null;
  votesFromFirst: number | null;
}): string {
  if (!input.live) return "Waiting for approval. You can still share your link.";
  const votes = `${input.voteCount} ${input.voteCount === 1 ? "vote" : "votes"}`;
  if (input.voteCount === 0 || input.rank == null) return "Share your link to get your first vote.";
  const place = ordinal(input.rank);
  if (input.rank === 1) return `${votes} · ${place} · In first place`;
  if (input.votesFromFirst != null) {
    const gap = `${input.votesFromFirst} ${input.votesFromFirst === 1 ? "vote" : "votes"} from the top place`;
    return `${votes} · ${place} · ${gap}`;
  }
  return `${votes} · ${place}`;
}
