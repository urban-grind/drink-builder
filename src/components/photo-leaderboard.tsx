"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { LeaderboardEntry } from "@/lib/photo-types";

function likeLabel(percent: number | null): string {
  if (percent === null) return "No votes yet";
  return `${percent}% liked`;
}

export function PhotoLeaderboard({ onBack }: { onBack: () => void }) {
  const [photos, setPhotos] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("The leaderboard didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ photos: LeaderboardEntry[] }>(`/api/photos/leaderboard?t=${Date.now()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setPhotos(data.photos);
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The leaderboard didn't load.");
      });
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="!h-11 !rounded-full !border !border-[#274b3a] !bg-white !px-4 !text-sm !font-bold !text-[#274b3a]"
        >
          Back to swiping
        </button>
      </div>
      <h1 className="mt-5 font-heading text-3xl leading-none">Leaderboard</h1>
      <p className="mt-2 text-sm">Ranked by votes. A tie goes to the higher like percentage.</p>

      {status === "loading" ? (
        <div role="status" className="mt-6 space-y-3">
          <p className="sr-only">Loading the leaderboard</p>
          <div className="h-20 animate-pulse rounded-2xl bg-[#e7e4de]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[#e7e4de]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[#e7e4de]" />
        </div>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="m-auto max-w-sm py-10 text-center">
          <p>{error}</p>
          <Button type="button" className="mt-6 h-12 rounded-full px-6" onClick={() => setReloadKey((value) => value + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {status === "ready" && photos.length === 0 ? (
        <p className="m-auto max-w-sm py-10 text-center text-lg">No photos on the board yet.</p>
      ) : null}

      {status === "ready" && photos.length > 0 ? (
        <ol className="mt-5 flex flex-col gap-3 pb-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <span className="w-6 shrink-0 text-center text-sm font-bold">{index + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{photo.personName.trim()}</p>
                <p className="truncate text-sm text-[#274b3a]/70">{photo.drinkName}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-2xl leading-none">{photo.voteCount}</p>
                <p className="text-xs font-bold">{photo.voteCount === 1 ? "vote" : "votes"}</p>
                <p className="mt-1 text-sm font-bold">{likeLabel(photo.likePercent)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
