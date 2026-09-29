"use client";

import Link from "next/link";
import { CupPhoto } from "@/components/cup-photo";
import { IngredientList } from "@/components/ingredient-list";
import { VoteButton } from "@/components/vote-button";
import type { PublicDrink } from "@/lib/types";

export function BoardRow({
  drink,
  rank,
  onUpdated,
}: {
  drink: PublicDrink;
  rank?: number;
  onUpdated: (drink: PublicDrink) => void;
}) {
  return (
    <li
      id={rank ? `drink-${drink.id}` : undefined}
      className="flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-2xl bg-white px-4 py-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)]"
    >
      {rank ? (
        <p className="ug-display text-4xl leading-none">
          <span className="sr-only">Rank </span>
          {rank}
        </p>
      ) : null}
      <CupPhoto drink={drink} className="mx-auto h-auto w-full max-w-[200px]" />
      <h3 className="text-2xl leading-tight text-balance">
        <Link
          href={`/drinks/${drink.id}`}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-[#274b3a]/40"
        >
          {drink.name}
        </Link>
      </h3>
      <p className="text-sm">{drink.creatorName}</p>
      <IngredientList recipe={drink} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-sm">
          <span className="ug-display text-3xl leading-none">{drink.voteCount}</span>{" "}
          {drink.voteCount === 1 ? "vote" : "votes"}
        </p>
        <VoteButton drink={drink} onUpdated={onUpdated} />
      </div>
    </li>
  );
}
