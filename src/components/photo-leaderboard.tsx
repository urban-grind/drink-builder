"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { LeaderboardEntry } from "@/lib/photo-types";

function likeLabel(percent: number | null): string {
  if (percent === null) return "No likes yet";
  return `${percent}% liked`;
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}

function PickCard({
  photo,
  rank,
  yours,
  prominent,
}: {
  photo: LeaderboardEntry;
  rank: number;
  yours: boolean;
  prominent: boolean;
}) {
  const date = shortDate(photo.createdAt);
  const name = photo.personName.trim();
  return (
    <article className={prominent ? "col-span-2 md:col-span-1" : ""}>
      <div className={`relative overflow-hidden rounded-2xl bg-[#e7e4de] ${prominent ? "aspect-[4/5] md:aspect-[3/4]" : "aspect-[3/4]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
        <span className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f2ef] text-sm font-semibold text-[#274b3a]">
          {rank}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pt-8 pb-2 text-white">
          <p className="flex items-center gap-1 text-[12px] font-medium">
            <HeartMark />
            <span>{photo.voteCount}</span>
          </p>
          <p className="text-[11px] font-normal text-white/90">{likeLabel(photo.likePercent)}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] leading-tight font-medium">
        {name}
        {date ? ` · ${date}` : ""}
      </p>
      <p className="text-[12px] leading-tight text-[#274b3a]/75">{photo.drinkName}</p>
      {yours ? <p className="text-xs font-semibold text-[#274b3a]">Your photo</p> : null}
    </article>
  );
}

export function PhotoLeaderboard({ mine, revision }: { mine: string[]; revision: number }) {
  const [photos, setPhotos] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const mineIds = new Set(mine);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ photos: LeaderboardEntry[] }>(`/api/photos/leaderboard?t=${Date.now()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setPhotos(data.photos);
        setError("");
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The top picks didn't load.");
      });
    return () => controller.abort();
  }, [reloadKey, revision]);

  return (
    <div className="pt-1">
      <h1 className="text-center font-heading text-[1.85rem] leading-none tracking-wide uppercase">Top picks.</h1>
      <p className="mt-2 text-center text-sm text-[#274b3a]/75">Your favourites, ranked.</p>

      {status === "loading" ? (
        <div role="status" className="mt-4">
          <p className="sr-only">Loading top picks</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            <div className="col-span-2 aspect-[4/5] animate-pulse rounded-2xl bg-[#e7e4de] md:col-span-1 md:aspect-[3/4]" />
            <div className="aspect-[3/4] animate-pulse rounded-2xl bg-[#e7e4de]" />
            <div className="hidden aspect-[3/4] animate-pulse rounded-2xl bg-[#e7e4de] md:block" />
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="py-6 text-center">
          <p>{error}</p>
          <Button type="button" className="mt-4 h-12 rounded-full bg-[#274b3a] px-6 text-[#f3f2ef]" onClick={() => setReloadKey((value) => value + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {status === "ready" && photos.length === 0 ? (
        <p className="py-8 text-center text-base">No photos on the board yet.</p>
      ) : null}

      {status === "ready" && photos.length > 0 ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3 md:gap-5">
            {photos.slice(0, 3).map((photo, index) => (
              <PickCard key={photo.id} photo={photo} rank={index + 1} prominent={index === 0} yours={mineIds.has(photo.id)} />
            ))}
          </div>
          {photos.length > 3 ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 md:mt-8 md:grid-cols-4 md:gap-4">
              {photos.slice(3).map((photo, index) => (
                <PickCard key={photo.id} photo={photo} rank={index + 4} prominent={false} yours={mineIds.has(photo.id)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
