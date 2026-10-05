function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

/** Votes, place, and the gap to the top two. A new entry has no rank yet. */
export function ownerStandingLine(input: {
  live: boolean;
  voteCount: number;
  rank: number | null;
  votesFromTopTwo: number | null;
}): string {
  if (!input.live) return "Waiting for approval. You can still share your link.";
  const votes = `${input.voteCount} ${input.voteCount === 1 ? "vote" : "votes"}`;
  if (input.voteCount === 0 || input.rank == null) return "Share your link to get your first vote.";
  const place = ordinal(input.rank);
  if (input.rank <= 2) return `${votes} · ${place} · In the top two`;
  if (input.votesFromTopTwo != null) {
    const gap = `${input.votesFromTopTwo} ${input.votesFromTopTwo === 1 ? "vote" : "votes"} from the top two`;
    return `${votes} · ${place} · ${gap}`;
  }
  return `${votes} · ${place}`;
}
