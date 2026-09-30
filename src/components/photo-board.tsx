"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhotoCard } from "@/components/photo-card";
import { useVoter } from "@/components/use-voter";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";
import { cn } from "@/lib/utils";

function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <p className="sr-only">Loading the photo board</p>
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
  const [error, setError] = useState("The photo board didn't load.");
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
        setError(caught instanceof ApiRequestError ? caught.message : "The photo board didn't load.");
      });
    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  function applyUpdate(updated: PublicPhoto) {
    setPopular((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(byPopularity));
    setNewest((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  const ranked = showAllPopular ? popular : popular.slice(0, 3);

  return (
    <div className="ug-board -mx-4 flex flex-col gap-10 px-4 py-8 sm:-mx-6 sm:px-6 sm:py-10">
      <div className="relative overflow-hidden bg-[#274b3a] px-5 py-10 text-[#f3f2ef] sm:px-8 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 right-0 size-56 rounded-full bg-[#1c3529]" />
        <div className="relative">
          <p className="text-xs font-bold tracking-[0.22em] text-[#f3f2ef]/75 uppercase">Real drinks</p>
          <h1 className="mt-3 text-5xl text-balance text-[#f3f2ef] sm:text-6xl">Photo contest</h1>
          <p className="mt-4 max-w-2xl text-pretty text-[#f3f2ef]/90">
            A photo of a drink you ordered. The cafe approves it, then it lands here. Most popular is the top three
            by votes. See all opens the rest, still highest first. New lists the 10 newest photos.
          </p>
          <Link
            href="/photos/enter"
            className={cn(
              buttonVariants(),
              "mt-6 inline-flex h-11 rounded-full bg-white px-5 text-[#274b3a] hover:bg-[#f3f2ef]",
            )}
          >
            Enter a photo
          </Link>
        </div>
      </div>

      {status === "loading" ? <BoardSkeleton /> : null}

      {status === "error" ? (
        <div role="alert" className="rounded-2xl bg-white px-5 py-8">
          <h2 className="text-2xl">The photo board didn&apos;t load</h2>
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
          <h2 className="text-2xl">No photos on the board yet</h2>
          <p className="mt-2 max-w-lg text-pretty">
            Enter a photo of a drink. It shows up here after the cafe approves it.
          </p>
          <Link
            href="/photos/enter"
            className={cn(buttonVariants(), "mt-4 h-11 rounded-full bg-[#274b3a] px-4 text-white hover:bg-[#1e3b2e]")}
          >
            Enter a photo
          </Link>
        </div>
      ) : null}

      {status === "ready" && popular.length > 0 ? (
        <>
          <section aria-labelledby="most-popular-photos" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="most-popular-photos" className="text-3xl">
                  Most popular
                </h2>
                <p className="mt-1 text-sm">
                  {showAllPopular ? "Every photo, highest votes first." : "Top three by votes."}
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
              <h2 id="new-photos" className="text-3xl">
                New
              </h2>
              <p className="mt-1 text-sm">The {newest.length} most recently approved photos.</p>
            </div>
            <ul className="grid list-none grid-cols-1 gap-3 lg:grid-cols-3">
              {newest.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onUpdated={applyUpdate} />
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
