"use client";

import Link from "next/link";

export type ContestTab = "vote" | "picks" | "mine";

const TABS = [
  ["vote", "Vote", "/"],
  ["picks", "Leaderboard", "/?picks=1"],
  ["mine", "My Entries", "/?mine=1"],
] as const;

export function ContestNav({
  current,
  showDrinks,
  onSelect,
}: {
  current: ContestTab | "drinks" | null;
  showDrinks: boolean;
  onSelect?: (tab: ContestTab) => void;
}) {
  const item =
    "flex flex-col items-center gap-0.5 rounded-full px-1.5 py-1 text-xs leading-none font-semibold whitespace-nowrap md:flex-row md:justify-center md:gap-2 md:px-4 md:py-2 md:text-base";

  return (
    <nav
      aria-label="Contest"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] md:px-10 md:pb-5"
    >
      <div
        className={`pointer-events-auto grid w-full ${showDrinks ? "max-w-[24rem] grid-cols-4" : "max-w-[20rem] grid-cols-3"} rounded-full bg-[#274b3a] px-1.5 py-1 shadow-[0_8px_22px_rgb(39_75_58/0.28)] md:max-w-7xl md:px-2 md:py-1.5`}
      >
        {TABS.map(([tab, label, href]) => {
          const selected = current === tab;
          const className = `${item} ${selected ? "bg-white text-[#274b3a]" : "text-white/85"}`;
          const icon = tab === "vote" ? <TabHeart filled={selected} /> : tab === "mine" ? <PhotoMark filled={selected} /> : <TrophyMark />;
          if (onSelect) {
            return (
              <button key={tab} type="button" aria-current={selected ? "page" : undefined} onClick={() => onSelect(tab)} className={className}>
                {icon}
                {label}
              </button>
            );
          }
          return (
            <Link key={tab} href={href} aria-current={selected ? "page" : undefined} className={className}>
              {icon}
              {label}
            </Link>
          );
        })}
        {showDrinks ? (
          <Link
            href="/top-drinks"
            aria-current={current === "drinks" ? "page" : undefined}
            className={`${item} ${current === "drinks" ? "bg-white text-[#274b3a]" : "text-white/85"}`}
          >
            <CupMark />
            Popular
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function TabHeart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}

function PhotoMark({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="14" rx="2" fill={filled ? "currentColor" : "none"} />
      <circle cx="9" cy="10" r="1.4" fill={filled ? "white" : "currentColor"} stroke="none" />
      <path d="M7 16l3.2-3.2a1 1 0 0 1 1.4 0L20 18" fill="none" stroke={filled ? "white" : "currentColor"} />
    </svg>
  );
}

function CupMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8h8.5a2.5 2.5 0 0 1 0 5H15" />
      <path d="M7 5h8v8a4 4 0 0 1-8 0V5z" />
      <path d="M8 20h8" />
    </svg>
  );
}

function TrophyMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v2.5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5.2A2.2 2.2 0 0 0 7.2 10" />
      <path d="M16 6h2.8A2.2 2.2 0 0 1 16.8 10" />
      <path d="M12 12.5V16" />
      <path d="M9 20h6" />
      <path d="M10 16h4v2a2 2 0 0 1-4 0v-2z" />
    </svg>
  );
}
