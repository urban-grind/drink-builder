"use client";

import { useState } from "react";
import { drinkShareLabel, type DrinkStats, type DrinkTotal } from "@/lib/drink-stats";

const TABS = [
  ["day", "Today", "The #1 pick today"],
  ["week", "This week", "The #1 pick this week"],
  ["month", "This month", "The #1 pick this month"],
] as const;

const PREVIEW = 5;

export function TopDrinks({ stats }: { stats: DrinkStats }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("day");
  const [open, setOpen] = useState(false);
  const current = TABS.find((item) => item[0] === tab) ?? TABS[0];
  const drinks = stats[current[0]];
  const shown = open ? drinks : drinks.slice(0, PREVIEW);
  const leader = shown[0];
  const rest = shown.slice(1);
  const leaderShare = drinks[0]?.share ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div role="tablist" aria-label="Drink rankings" className="flex flex-wrap items-center gap-1">
        {TABS.map(([key, title]) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setTab(key);
                setOpen(false);
              }}
              className={
                selected
                  ? "rounded-full bg-[#274b3a] px-5 py-2.5 text-sm font-semibold text-[#f7f4ec]"
                  : "!rounded-full !bg-transparent px-4 py-2.5 text-sm font-semibold !text-[#274b3a]/70 hover:!bg-transparent"
              }
            >
              {title}
            </button>
          );
        })}
      </div>

      {leader ? (
        <div className="mt-6 flex items-center gap-5 rounded-[1.35rem] bg-[#274b3a] px-6 py-7 text-[#f7f4ec] sm:gap-8 sm:px-8 sm:py-8">
          <DrinkPhoto imageUrl={leader.imageUrl} large onDark />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#f7f4ec]/75 uppercase">{current[2]}</p>
            <h1 className="mt-3 font-heading text-4xl leading-tight sm:text-5xl">{leader.name}</h1>
            <p className="sr-only">{drinkShareLabel(leader.share)} of drinks ordered</p>
            <div className="mt-6 w-40 max-w-full">
              <ShareBar share={leader.share} leader={leaderShare} onDark />
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-[#274b3a]/70">No drinks yet.</p>
      )}

      {rest.length > 0 ? (
        <ol className="mt-6" start={2}>
          {rest.map((drink, index) => (
            <DrinkRow key={drink.name} drink={drink} rank={index + 2} leader={leaderShare} />
          ))}
        </ol>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4 text-sm">
        <p className="text-[#274b3a]/60">Based on drinks sold · Eastern time</p>
        {drinks.length > PREVIEW ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="!bg-transparent !px-0 !py-0 font-semibold !text-[#274b3a] underline underline-offset-4 hover:!bg-transparent"
          >
            {open ? "Show fewer" : "See more favourites"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DrinkRow({ drink, rank, leader }: { drink: DrinkTotal; rank: number; leader: number }) {
  return (
    <li className="flex items-center gap-4 border-t border-[#274b3a]/12 py-4">
      <span className="w-6 shrink-0 text-[#7d9488]">{rank}</span>
      <DrinkPhoto imageUrl={drink.imageUrl} />
      <p className="min-w-0 flex-1 font-semibold text-[#274b3a]">{drink.name}</p>
      <div className="w-24 shrink-0 sm:w-32">
        <ShareBar share={drink.share} leader={leader} />
      </div>
      <span className="sr-only">{drinkShareLabel(drink.share)} of drinks ordered</span>
    </li>
  );
}

function DrinkPhoto({
  imageUrl,
  large = false,
  onDark = false,
}: {
  imageUrl: string | null;
  large?: boolean;
  onDark?: boolean;
}) {
  const frame = large ? "h-24 w-24 sm:h-32 sm:w-32" : "h-11 w-11";
  if (!imageUrl) {
    return (
      <span
        aria-hidden="true"
        className={`grid ${frame} shrink-0 place-items-center rounded-2xl ${onDark ? "bg-white/10 text-[#f7f4ec]" : "bg-[#e7f0ea] text-[#274b3a]"}`}
      >
        <CupMark />
      </span>
    );
  }
  return (
    // Square hosts the catalog photo. The drink name sits beside it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className={`${frame} shrink-0 rounded-2xl bg-[#e7e4de] object-cover`} />
  );
}

function CupMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M6 8h10v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8z" />
      <path d="M16 9h2.2a2.2 2.2 0 0 1 0 4.4H16" strokeLinecap="round" />
      <path d="M8 4.5c.4.8.4 1.4 0 2.2M12 4.5c.4.8.4 1.4 0 2.2" strokeLinecap="round" />
    </svg>
  );
}

function ShareBar({ share, leader, onDark = false }: { share: number; leader: number; onDark?: boolean }) {
  const width = leader > 0 ? Math.max(share > 0 ? 8 : 0, (share / leader) * 100) : 0;
  return (
    <div className={`h-1.5 overflow-hidden rounded-full ${onDark ? "bg-white/20" : "bg-[#e4e1da]"}`} aria-hidden="true">
      <div className={`h-full rounded-full ${onDark ? "bg-[#f3f2ef]" : "bg-[#274b3a]"}`} style={{ width: `${width}%` }} />
    </div>
  );
}
