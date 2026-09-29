"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CupPreview } from "@/components/cup-preview";
import { VoteButton } from "@/components/vote-button";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { forgetVote, rememberVote } from "@/lib/local-votes";
import { formatWhen } from "@/lib/time";
import type { PublicDrink } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DrinkDetail({ id }: { id: string }) {
  const { voterId, ready } = useVoter();
  const [drink, setDrink] = useState<PublicDrink | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("This drink didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ voterId });
    requestJson<{ drink: PublicDrink }>(`/api/drinks/${id}?${query.toString()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (data.drink.voted) rememberVote(data.drink.id);
        else forgetVote(data.drink.id);
        setDrink(data.drink);
        setStatus("ready");
        document.title = `${data.drink.name} · Drink Builder`;
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiRequestError && caught.code === "NOT_FOUND") {
          setStatus("missing");
          return;
        }
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "This drink didn't load.");
      });
    return () => controller.abort();
  }, [id, ready, voterId, reloadKey]);

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="grid gap-6 lg:grid-cols-2">
        <p className="sr-only">Loading the drink</p>
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="rounded-2xl bg-white px-6 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="font-heading text-4xl">That drink isn&apos;t on the board</h1>
        <p className="mt-2 text-muted-foreground">It may have been a bad link.</p>
        <Link href="/drinks" className={cn(buttonVariants(), "mt-4 h-11 rounded-full px-4")}>
          Back to the board
        </Link>
      </div>
    );
  }

  if (status === "error" || !drink) {
    return (
      <div role="alert" className="rounded-2xl bg-white px-6 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="font-heading text-4xl">This drink didn&apos;t load</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
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
    );
  }

  return (
    <article className="grid items-start gap-8 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <CupPreview recipe={drink} />
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          <Link href="/drinks" className="underline-offset-4 hover:underline">
            The board
          </Link>
        </p>
        <h1 className="font-heading text-4xl text-balance sm:text-5xl">{drink.name}</h1>
        <p className="text-muted-foreground">By {drink.creatorName}</p>
        {drink.description ? <p className="max-w-xl text-pretty text-lg">{drink.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <VoteButton drink={drink} onUpdated={setDrink} />
          <p className="text-sm text-muted-foreground">
            <span className="font-heading text-3xl text-foreground">{drink.voteCount}</span>{" "}
            {drink.voteCount === 1 ? "vote" : "votes"}
          </p>
          <time dateTime={drink.createdAt} className="text-sm text-muted-foreground">
            {formatWhen(drink.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
