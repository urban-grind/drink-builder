export const VOTE_BADGES = [
  { id: "bronze", name: "Bronze", votes: 50 },
  { id: "silver", name: "Silver", votes: 100 },
  { id: "gold", name: "Gold", votes: 250 },
  { id: "platinum", name: "Platinum", votes: 500 },
] as const;

export type VoteBadgeId = (typeof VOTE_BADGES)[number]["id"];

export function badgeEarned(voteCount: number, votes: number): boolean {
  return voteCount >= votes;
}
