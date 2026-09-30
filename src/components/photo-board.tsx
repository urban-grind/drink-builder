"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhotoCard } from "@/components/photo-card";
import { useVoter } from "@/components/use-voter";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";
import { cn } from "@/lib/utils";

const WALL_PHOTO = "/photos/wall-drink.jpg";
const CUP_PHOTO = "/photos/cup-beans.jpg";
const COUNTER_PHOTO = "/photos/counter.jpg";

function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <p className="sr-only">Loading photos</p>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-80 animate-pulse bg-white" />
      ))}
    </div>
  );
}

function byPopularity(a: PublicPhoto, b: PublicPhoto): number {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  return b.createdAt.localeCompare(a.createdAt);
}

export function PhotoBoard() {
  const { voterId, ready } = useVoter();
  const [popular, setPopular] = useState<PublicPhoto[]>([]);
  const [newest, setNewest] = useState<PublicPhoto[]>([]);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("The photos didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    requestJson<{ popular: PublicPhoto[]; newest: PublicPhoto[] }>(
      `/api/photos?${new URLSearchParams({ voterId }).toString()}`,
      { signal: controller.signal },
    )
      .then((data) => {
        setPopular(data.popular);
        setNewest(data.newest);
        setStatus("ready");
        const hash = window.location.hash.replace("#", "");
        if (hash.startsWith("photo-")) {
          const id = hash.slice("photo-".length);
          const index = data.popular.findIndex((photo) => photo.id === id);
          if (index >= 3) setShowAllPopular(true);
          window.setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ block: "center" });
          }, 50);
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The photos didn't load.");
      });
    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  function applyUpdate(updated: PublicPhoto) {
    setPopular((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(byPopularity));
    setNewest((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  const ranked = showAllPopular ? popular : popular.slice(0, 3);

  return (
    <div className="ug-board -mx-4 -mt-8 flex flex-col gap-12 px-4 pb-4 sm:-mx-6 sm:-mt-12 sm:px-6">
      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={WALL_PHOTO}
          alt="Urban Grind on the wall, and an iced drink in hand"
          className="-mx-4 aspect-[3/4] w-[calc(100%+2rem)] max-w-none object-cover sm:-mx-6 sm:w-[calc(100%+3rem)] lg:mx-0 lg:aspect-[3/4] lg:w-full"
        />
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] uppercase">Urban Grind</p>
            <h1 className="mt-3 text-5xl leading-[0.92] text-balance sm:text-7xl lg:text-8xl">Get it on the board</h1>
            <p className="mt-4 max-w-xl text-lg text-pretty sm:text-xl">
              Snap the drink. Put it on the board. Barrie votes.
            </p>
            <Link
              href="/photos/enter"
              className={cn(buttonVariants(), "mt-6 inline-flex h-12 rounded-full px-6 text-base")}
            >
              Snap yours
            </Link>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CUP_PHOTO}
            alt="A takeaway cup in coffee beans"
            className="aspect-[3/4] w-full object-cover"
          />
        </div>
      </section>

      {status === "loading" ? <BoardSkeleton /> : null}

      {status === "error" ? (
        <div role="alert" className="rounded-2xl bg-white px-5 py-8">
          <h2 className="text-2xl">The photos didn&apos;t load</h2>
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
        <section aria-labelledby="open-spot" className="flex flex-col gap-4">
          <h2 id="open-spot" className="text-4xl sm:text-5xl">
            The board
          </h2>
          <div className="bg-white px-6 py-12 sm:px-10 sm:py-16">
            <p className="font-heading max-w-xl text-4xl text-balance sm:text-6xl">First cup&apos;s open.</p>
            <p className="mt-3 max-w-md text-lg text-pretty">Snap yours and take it.</p>
            <Link
              href="/photos/enter"
              className={cn(buttonVariants(), "mt-6 inline-flex h-12 rounded-full px-6 text-base")}
            >
              Snap yours
            </Link>
          </div>
        </section>
      ) : null}

      {status === "ready" && popular.length > 0 ? (
        <>
          <section aria-labelledby="most-popular-photos" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="most-popular-photos" className="text-4xl sm:text-5xl">
                  The board
                </h2>
                <p className="mt-1 text-sm">
                  {showAllPopular ? "Every cup, votes first." : "The cups Barrie likes."}
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
              {ranked.map((photo, index) => (
                <PhotoCard key={photo.id} photo={photo} rank={index + 1} onUpdated={applyUpdate} />
              ))}
            </ol>
          </section>
          <section aria-labelledby="new-photos" className="flex flex-col gap-4">
            <div>
              <h2 id="new-photos" className="text-4xl">
                Just in
              </h2>
              <p className="mt-1 text-sm">The newest cups.</p>
            </div>
            <ul className="grid list-none grid-cols-1 gap-3 lg:grid-cols-3">
              {newest.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onUpdated={applyUpdate} />
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={COUNTER_PHOTO}
        alt="The counter at Urban Grind, with the grinder and stacked cups"
        className="mx-auto aspect-[3/4] w-full max-w-xl object-cover"
      />
    </div>
  );
}
