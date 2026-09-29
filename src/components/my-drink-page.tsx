"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DrinkCongrats } from "@/components/drink-congrats";
import { useMyDrinkId } from "@/components/use-my-drink";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useClientReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function MyDrinkPage() {
  const ready = useClientReady();
  const myDrinkId = useMyDrinkId();

  if (!ready) {
    return (
      <div role="status" aria-live="polite" className="mx-auto grid max-w-md gap-4">
        <p className="sr-only">Loading your drink</p>
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (!myDrinkId) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white px-6 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="font-heading text-4xl text-balance sm:text-5xl">My drink</h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          This browser hasn&apos;t published a drink yet. Build one, and it will show up here with the Instagram
          downloads.
        </p>
        <Link href="/" className={cn(buttonVariants(), "mt-6 h-11 rounded-full px-4")}>
          Build a drink
        </Link>
      </div>
    );
  }

  return <DrinkCongrats id={myDrinkId} />;
}
