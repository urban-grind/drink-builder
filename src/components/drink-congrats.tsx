"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CupPhoto } from "@/components/cup-photo";
import { IngredientList } from "@/components/ingredient-list";
import { InstagramDownloads } from "@/components/instagram-downloads";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicDrink } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DrinkCongrats({ id }: { id: string }) {
  const [drink, setDrink] = useState<PublicDrink | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("This drink didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ drink: PublicDrink }>(`/api/drinks/${id}`, { signal: controller.signal })
      .then((data) => {
        setDrink(data.drink);
        setStatus("ready");
        document.title = `My drink · Drink Builder`;
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
  }, [id, reloadKey]);

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="mx-auto grid max-w-md gap-4">
        <p className="sr-only">Loading the drink</p>
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
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
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="font-heading text-4xl text-balance sm:text-5xl">My drink</h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          {drink.name} is published. Save a story and a square for Instagram. The picture has the cup and the drink
          name.
        </p>
      </div>
      <figure className="rounded-2xl bg-white px-5 py-8 shadow-[0_24px_60px_rgb(39_75_58/0.08)] sm:px-8">
        <p className="min-h-14 text-center font-heading text-4xl leading-none text-balance text-[#274b3a] sm:text-5xl">
          {drink.name}
        </p>
        <p className="mt-3 text-center text-xs font-bold tracking-[0.18em] text-[#3f5d4e] uppercase">Your cup</p>
        <CupPhoto drink={drink} className="mx-auto mt-2 h-auto w-full max-w-[320px]" />
        <IngredientList recipe={drink} className="mt-6 justify-center" />
      </figure>
      <InstagramDownloads drink={drink} />
      <Link href="/drinks" className={cn(buttonVariants(), "h-11 w-fit rounded-full px-4")}>
        See the board
      </Link>
    </div>
  );
}
