"use client";

import { useEffect, useState } from "react";
import { OpenUploadButton } from "@/components/upload-dialog";
import { PhotoCard } from "@/components/photo-card";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";

const WALL_PHOTO = "/photos/wall-drink.jpg";

const uploadClass =
  "inline-flex items-center justify-center rounded-full bg-[#274b3a] px-7 py-3.5 text-sm font-bold tracking-[0.14em] text-[#f3f2ef] uppercase shadow-lg transition-colors hover:bg-[#1e3b2e]";

function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      <p className="sr-only">Loading photos</p>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#274b3a]/10">
          <div className="aspect-[4/5] animate-pulse rounded-xl bg-[#e7e4de]" />
        </div>
      ))}
    </div>
  );
}

function sortList(photos: PublicPhoto[], sort: "top" | "newest"): PublicPhoto[] {
  const next = [...photos];
  if (sort === "top") {
    next.sort((a, b) => b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt));
  } else {
    next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return next;
}

export function PhotoBoard() {
  const { voterId, ready } = useVoter();
  const [popular, setPopular] = useState<PublicPhoto[]>([]);
  const [newest, setNewest] = useState<PublicPhoto[]>([]);
  const [sort, setSort] = useState<"top" | "newest">("top");
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
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The photos didn't load.");
      });
    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  function applyUpdate(updated: PublicPhoto) {
    setPopular((current) => sortList(current.map((item) => (item.id === updated.id ? updated : item)), "top"));
    setNewest((current) => sortList(current.map((item) => (item.id === updated.id ? updated : item)), "newest"));
  }

  const photos = sort === "top" ? popular : newest;

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-8 -mb-8 sm:-mt-12 sm:-mb-12">
      <section className="bg-[#274b3a] text-[#f3f2ef]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <h1 className="font-heading text-[3.15rem] uppercase leading-[0.88] tracking-tight text-balance sm:text-7xl lg:text-8xl">
              Show us <span className="italic text-[#c4622d]">your</span> cup
            </h1>
            <p className="mt-5 font-heading text-2xl uppercase leading-tight tracking-wide text-[#f3f2ef]/80 sm:text-3xl">
              <span className="italic text-[#c4622d]">Your</span> drink moment
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <OpenUploadButton className="inline-flex items-center justify-center rounded-full bg-[#f3f2ef] px-7 py-3.5 text-sm font-bold tracking-[0.14em] text-[#274b3a] uppercase shadow-lg">
                Upload a photo
              </OpenUploadButton>
              <a
                href="#the-board"
                className="inline-flex items-center justify-center rounded-full border border-[#f3f2ef] bg-transparent px-7 py-3.5 text-sm font-bold tracking-[0.14em] text-[#f3f2ef] uppercase"
              >
                See the board
              </a>
            </div>
          </div>
          <div className="px-3 py-4 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WALL_PHOTO}
              alt="Urban Grind on the wall, and an iced drink in hand"
              className="aspect-[3/4] w-full rotate-2 rounded-[2rem] object-cover shadow-[0_24px_60px_rgb(39_75_58/0.18)]"
            />
          </div>
        </div>
      </section>

      <section id="the-board" aria-labelledby="drink-moment" className="scroll-mt-24 bg-[#f3f2ef] px-6 pb-16 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-7xl">
          <h2 id="drink-moment" className="font-heading text-4xl uppercase leading-[0.9] tracking-tight sm:text-6xl">
            <span className="italic text-[#c4622d]">Your</span> drink moment
          </h2>
          <OpenUploadButton className={`${uploadClass} mt-6 w-full`}>Got a good one? Upload it</OpenUploadButton>

          <div className="mt-8 flex gap-6 border-b border-[#274b3a]/15" role="tablist" aria-label="Sort the photos">
            {(
              [
                ["top", "Top"],
                ["newest", "Newest"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={sort === value}
                onClick={() => setSort(value)}
                className={
                  sort === value
                    ? "!rounded-none !bg-transparent !px-0 !pb-3 !text-base !font-bold !tracking-wide !text-[#274b3a] uppercase shadow-none border-b-2 border-[#274b3a]"
                    : "!rounded-none !bg-transparent !px-0 !pb-3 !text-base !font-bold !tracking-wide !text-[#274b3a]/45 uppercase"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {status === "loading" ? <BoardSkeleton /> : null}

          {status === "error" ? (
            <div role="alert" className="mt-8 rounded-3xl bg-white px-6 py-12 shadow-lg">
              <h3 className="font-heading text-3xl">The photos didn&apos;t load</h3>
              <p className="mt-3 max-w-md">{error}</p>
              <Button
                type="button"
                onClick={() => {
                  setStatus("loading");
                  setReloadKey((value) => value + 1);
                }}
                className="mt-6 h-12 rounded-full px-7"
              >
                Try again
              </Button>
            </div>
          ) : null}

          {status === "ready" && photos.length === 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex aspect-[4/5] flex-col justify-end rounded-[2rem] bg-[#274b3a] p-6 text-[#f3f2ef] shadow-lg md:col-span-1">
                <p className="font-heading text-4xl uppercase leading-[0.95] sm:text-5xl">
                  Your <span className="italic text-[#f3c7a8]">drink</span>
                </p>
                <p className="mt-3 max-w-[12rem] text-sm text-[#f3f2ef]/80">The first cup on the board.</p>
                <div className="mt-6">
                  <OpenUploadButton className="inline-flex items-center justify-center rounded-full bg-[#f3f2ef] px-5 py-3 text-sm font-bold tracking-[0.12em] text-[#274b3a] uppercase">
                    Upload a photo
                  </OpenUploadButton>
                </div>
              </div>
            </div>
          ) : null}

          {status === "ready" && photos.length > 0 ? (
            <ul className="mt-8 grid list-none grid-cols-1 gap-4 md:grid-cols-3">
              {photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onUpdated={applyUpdate} />
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
