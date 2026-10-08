import { VOTE_BADGES, badgeEarned, type VoteBadgeId } from "@/lib/vote-badges";

const earnedStyle: Record<VoteBadgeId, string> = {
  bronze: "bg-[#a56b3c] text-white",
  silver: "bg-[#8d949c] text-white",
  gold: "bg-[#c4962c] text-white",
  platinum: "bg-[#5e7384] text-white",
};

export function VoteBadges({ voteCount }: { voteCount: number }) {
  return (
    <div role="list" aria-label="Vote badges" className="mt-2 grid grid-cols-4 gap-1.5">
      {VOTE_BADGES.map((badge) => {
        const earned = badgeEarned(voteCount, badge.votes);
        return (
          <div
            role="listitem"
            key={badge.id}
            aria-label={`${badge.name}, ${badge.votes} votes, ${earned ? "earned" : "not yet"}`}
            className={`flex flex-col items-center justify-center rounded-xl px-1 py-2 text-center leading-none ${
              earned ? earnedStyle[badge.id] : "bg-[#eceae4] text-[#274b3a]/40"
            }`}
          >
            <span className="text-xs font-semibold">{badge.name}</span>
            <span className="mt-1 text-[11px]">{earned ? "Earned" : badge.votes}</span>
          </div>
        );
      })}
    </div>
  );
}
