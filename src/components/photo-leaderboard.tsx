"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { LeaderboardEntry } from "@/lib/photo-types";

function likeLabel(percent: number | null): string {
  if (percent === null) return "No votes yet";
  return `${percent}% liked`;
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
        setError(caught instanceof ApiRequestError ? caught.message : "The leaderboard didn't load.");
      });
    return () => controller.abort();
  }, [reloadKey, revision]);

  return (
    <div className="pt-4">
      <h2 id="photo-leaderboard-heading" className="font-heading text-3xl leading-none">
        Leaderboard
      </h2>
      <p className="mt-2 text-sm">Ranked by votes. A tie goes to the higher like percentage.</p>

      {status === "loading" ? (
        <div role="status" className="mt-4 space-y-3">
          <p className="sr-only">Loading the leaderboard</p>
          <div className="h-20 animate-pulse rounded-2xl bg-[#e7e4de]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[#e7e4de]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[#e7e4de]" />
        </div>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="py-6 text-center">
          <p>{error}</p>
          <Button type="button" className="mt-4 h-12 rounded-full px-6" onClick={() => setReloadKey((value) => value + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {status === "ready" && photos.length === 0 ? (
        <p className="py-6 text-center text-lg">No photos on the board yet.</p>
      ) : null}

      {status === "ready" && photos.length > 0 ? (
        <ol className="mt-4 flex flex-col gap-3">
          {photos.map((photo, index) => {
            const yours = mineIds.has(photo.id);
            return (
              <li key={photo.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <span className="w-6 shrink-0 text-center text-sm font-bold">{index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{photo.personName.trim()}</p>
                  {yours ? <p className="text-xs font-bold tracking-wide text-[#274b3a]">Your photo</p> : null}
                  <p className="truncate text-sm text-[#274b3a]/70">{photo.drinkName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-heading text-2xl leading-none">{photo.voteCount}</p>
                  <p className="text-xs font-bold">{photo.voteCount === 1 ? "vote" : "votes"}</p>
                  <p className="mt-1 text-sm font-bold">{likeLabel(photo.likePercent)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
