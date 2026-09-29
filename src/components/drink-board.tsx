"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BoardRow } from "@/components/board-row";
import { useVoter } from "@/components/use-voter";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { replaceVoteIds } from "@/lib/local-votes";
import type { PublicDrink } from "@/lib/types";
import { cn } from "@/lib/utils";

function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <p className="sr-only">Loading the board</p>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-80 animate-pulse bg-white" />
      ))}
    </div>
  );
}

function byPopularity(a: PublicDrink, b: PublicDrink): number {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  return b.createdAt.localeCompare(a.createdAt);
}

export function DrinkBoard() {
  const { voterId, ready } = useVoter();
  const [popular, setPopular] = useState<PublicDrink[]>([]);
  const [newest, setNewest] = useState<PublicDrink[]>([]);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("The board didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();

    requestJson<{ popular: PublicDrink[]; newest: PublicDrink[] }>(
      `/api/drinks?${new URLSearchParams({ voterId }).toString()}`,
      { signal: controller.signal },
    )
      .then((data) => {
        const voted = new Set<string>();
        for (const drink of [...data.popular, ...data.newest]) {
          if (drink.voted) voted.add(drink.id);
        }
        replaceVoteIds([...voted]);
        setPopular(data.popular);
        setNewest(data.newest);
        setStatus("ready");
        const hash = window.location.hash.replace("#", "");
        if (hash.startsWith("drink-")) {
          const id = hash.slice("drink-".length);
          const index = data.popular.findIndex((drink) => drink.id === id);
          if (index >= 3) setShowAllPopular(true);
          window.setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ block: "center" });
          }, 50);
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The board didn't load.");
      });

    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  function applyUpdate(updated: PublicDrink) {
    setPopular((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(byPopularity));
    setNewest((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  const ranked = showAllPopular ? popular : popular.slice(0, 3);

  return (
    <div className="ug-board -mx-4 flex flex-col gap-10 px-4 py-8 sm:-mx-6 sm:px-6 sm:py-10">
        <div className="relative overflow-hidden bg-[#274b3a] px-5 py-10 text-[#f3f2ef] sm:px-8 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 right-0 size-56 rounded-full bg-[#1c3529]" />
        <div className="relative">
        <p className="text-xs font-bold tracking-[0.22em] text-[#f3f2ef]/75 uppercase">Votes on the wall</p>
        <h1 className="mt-3 text-5xl text-balance text-[#f3f2ef] sm:text-6xl">The board</h1>
        <p className="mt-4 max-w-2xl text-pretty text-[#f3f2ef]/90">
          Most popular is the top three by votes. See all opens the rest, still highest first. New lists the 10
          newest drinks. You can vote on your own.
        </p>
        </div>
      </div>

      {status === "loading" ? <BoardSkeleton /> : null}

      {status === "error" ? (
        <div role="alert" className="rounded-2xl bg-white px-5 py-8">
          <h2 className="text-2xl">The board didn&apos;t load</h2>
          <p className="mt-2 max-w-lg">{error}</p>
          <Button
            type="button"
            onClick={() => {
              setStatus("loading");
              setReloadKey((value) => value + 1);
            }}
            className="mt-4 h-11 rounded-full px-4"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {status === "ready" && popular.length === 0 ? (
        <div className="rounded-2xl bg-white px-5 py-10">
          <h2 className="text-2xl">Nothing on the board yet</h2>
          <p className="mt-2 max-w-lg text-pretty">
            The pass is empty. Build a drink and it takes the first spot by the window.
          </p>
          <Link
            href="/"
            className={cn(buttonVariants(), "mt-4 h-11 rounded-full bg-[#274b3a] px-4 text-white hover:bg-[#1e3b2e]")}
          >
            Build a drink
          </Link>
        </div>
      ) : null}

      {status === "ready" && popular.length > 0 ? (
        <>
          <section aria-labelledby="most-popular" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="most-popular" className="text-3xl">
                  Most popular
                </h2>
                <p className="mt-1 text-sm">
                  {showAllPopular ? "Every drink, highest votes first." : "Top three by votes."}
                </p>
              </div>
              {popular.length > 3 ? (
                <Button
                  type="button"
                  aria-expanded={showAllPopular}
                  onClick={() => setShowAllPopular((open) => !open)}
                  className="h-11 rounded-full px-5"
                >
                  {showAllPopular ? "Show top 3" : "See all"}
                </Button>
              ) : null}
            </div>
            <ol className="grid list-none grid-cols-1 gap-3 lg:grid-cols-3">
              {ranked.map((drink, index) => (
                <BoardRow key={drink.id} drink={drink} rank={index + 1} onUpdated={applyUpdate} />
              ))}
            </ol>
          </section>
          <section aria-labelledby="new-drinks" className="flex flex-col gap-4">
            <div>
              <h2 id="new-drinks" className="text-3xl">
                New
              </h2>
              <p className="mt-1 text-sm">The {newest.length} most recently created drinks.</p>
            </div>
            <ul className="grid list-none grid-cols-1 gap-3 lg:grid-cols-3">
              {newest.map((drink) => (
                <BoardRow key={drink.id} drink={drink} onUpdated={applyUpdate} />
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
