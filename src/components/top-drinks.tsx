"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CupPhoto } from "@/components/cup-photo";
import { useVoter } from "@/components/use-voter";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { replaceVoteIds } from "@/lib/local-votes";
import type { PublicDrink } from "@/lib/types";

function ShowcaseCard({ drink, rank }: { drink: PublicDrink; rank: number }) {
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-2xl bg-white px-5 py-7 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
      <p className="font-heading text-5xl leading-none">
        <span className="sr-only">Rank </span>
        {rank}
      </p>
      <CupPhoto drink={drink} className="mx-auto h-auto w-full max-w-[260px]" />
      <h3 className="text-3xl leading-tight text-balance">
        <Link
          href={`/drinks/${drink.id}`}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-[#274b3a]/40"
        >
          {drink.name}
        </Link>
      </h3>
      <p>{drink.creatorName}</p>
    </li>
  );
}

export function TopDrinks() {
  const { voterId, ready } = useVoter();
  const [popular, setPopular] = useState<PublicDrink[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("The top drinks didn't load.");
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
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The top drinks didn't load.");
      });

    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  const ranked = popular.slice(0, 3);

  return (
    <section aria-labelledby="top-drinks" className="flex flex-col gap-6">
      <div>
        <h2 id="top-drinks" className="text-4xl text-balance sm:text-5xl">
          What Barrie is drinking
        </h2>
        <p className="mt-3 max-w-2xl text-pretty">The three cups with the most votes.</p>
      </div>

      {status === "loading" ? (
        <div role="status" aria-live="polite" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <p className="sr-only">Loading the top drinks</p>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-[28rem] animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="rounded-2xl bg-white px-5 py-8">
          <h3 className="text-2xl">The top drinks didn&apos;t load</h3>
          <p className="mt-2">{error}</p>
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

      {status === "ready" && ranked.length === 0 ? (
        <div className="rounded-2xl bg-white px-5 py-8">
          <h3 className="text-2xl">No drinks on the board yet</h3>
          <p className="mt-2">Build the first cup below.</p>
        </div>
      ) : null}

      {status === "ready" && ranked.length > 0 ? (
        <>
          <ol className="grid list-none grid-cols-1 gap-4 lg:grid-cols-3">
            {ranked.map((drink, index) => (
              <ShowcaseCard key={drink.id} drink={drink} rank={index + 1} />
            ))}
          </ol>
          <Link href="/drinks" className={cn(buttonVariants(), "h-11 w-fit rounded-full px-5")}>
            See the board
          </Link>
        </>
      ) : null}
    </section>
  );
}
