"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoDetail } from "@/components/photo-detail";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { LeaderboardEntry, PublicPhoto } from "@/lib/photo-types";

const PAGE_SIZE = 4;

type LeaderboardPage = {
  photos: LeaderboardEntry[];
  hasMore: boolean;
};

function likeLabel(percent: number | null): string {
  if (percent === null) return "No likes yet";
  return `${percent}% liked`;
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function pagePath(offset: number): string {
  const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
  return `/api/photos/leaderboard?${params.toString()}`;
}

const PRIZE_RANKS = 2;

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}

function PickCard({
  photo,
  rank,
  yours,
  onOpen,
}: {
  photo: LeaderboardEntry;
  rank: number;
  yours: boolean;
  onOpen: (code: string) => void;
}) {
  const date = shortDate(photo.createdAt);
  const name = photo.personName.trim();
  const prize = rank <= PRIZE_RANKS;
  const place = prize ? "Free coffee for a month" : `Rank ${rank}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(photo.code)}
      disabled={!photo.code}
      aria-label={yours ? `Your photo, ${place}, ${photo.drinkName}` : `${place}, ${photo.drinkName}`}
      className="cursor-pointer border-0 bg-transparent p-0 text-left text-[#274b3a]"
    >
      <div
        className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#e7e4de] ${yours ? "outline outline-[3px] outline-offset-2 outline-[#274b3a]" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbUrl}
          alt=""
          loading={rank <= PAGE_SIZE ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
        {prize ? (
          <span className="absolute inset-x-2 top-2 rounded-full bg-[#274b3a] px-2 py-1.5 text-center text-[10px] leading-tight font-bold tracking-[0.08em] text-[#f3f2ef] uppercase">
            Free coffee for a month
          </span>
        ) : (
          <span className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f2ef] text-sm font-semibold text-[#274b3a]">
            {rank}
          </span>
        )}
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-full bg-[#f3f2ef]/95 px-2.5 py-1.5 text-[#274b3a] shadow-[0_6px_16px_rgb(0_0_0/0.18)]">
          <p className="flex items-center gap-1 text-sm font-bold">
            <HeartMark />
            <span>{photo.voteCount}</span>
          </p>
          <p className="text-xs font-semibold">{likeLabel(photo.likePercent)}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] leading-tight font-medium">
        {name}
        {date ? ` · ${date}` : ""}
      </p>
      <p className="text-[12px] leading-tight text-[#274b3a]/75">{photo.drinkName}</p>
      {yours ? <p className="text-xs font-semibold text-[#274b3a]">Your photo</p> : null}
    </button>
  );
}

export function PhotoLeaderboard({
  mine,
  revision,
  onEnter,
}: {
  mine: string[];
  revision: number;
  onEnter?: () => void;
}) {
  const [photos, setPhotos] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<LeaderboardEntry[]>([]);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const generation = useRef(0);
  const mineIds = new Set(mine);
  photosRef.current = photos;

  useEffect(() => {
    const controller = new AbortController();
    const gen = generation.current + 1;
    generation.current = gen;
    hasMoreRef.current = false;
    loadingRef.current = false;
    requestJson<LeaderboardPage>(pagePath(0), { signal: controller.signal })
      .then((data) => {
        if (gen !== generation.current) return;
        photosRef.current = data.photos;
        hasMoreRef.current = data.hasMore;
        setPhotos(data.photos);
        setHasMore(data.hasMore);
        setMoreError("");
        setError("");
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted || gen !== generation.current) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The top picks didn't load.");
      });
    return () => controller.abort();
  }, [reloadKey, revision]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || status !== "ready" || !hasMore) return;
    let cancelled = false;

    async function loadMore() {
      if (cancelled || loadingRef.current || !hasMoreRef.current) return;
      loadingRef.current = true;
      setLoadingMore(true);
      setMoreError("");
      const gen = generation.current;
      const offset = photosRef.current.length;
      try {
        const data = await requestJson<LeaderboardPage>(pagePath(offset));
        if (cancelled || gen !== generation.current) return;
        const seen = new Set(photosRef.current.map((photo) => photo.id));
        const more = data.photos.filter((photo) => !seen.has(photo.id));
        if (more.length > 0) {
          photosRef.current = [...photosRef.current, ...more];
          setPhotos(photosRef.current);
        }
        hasMoreRef.current = data.hasMore && more.length > 0;
        setHasMore(hasMoreRef.current);
      } catch (caught) {
        if (cancelled || gen !== generation.current) return;
        hasMoreRef.current = false;
        setHasMore(false);
        setMoreError(caught instanceof ApiRequestError ? caught.message : "The next photos didn't load.");
      } finally {
        loadingRef.current = false;
        if (!cancelled && gen === generation.current) setLoadingMore(false);
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [status, hasMore, photos.length]);

  useEffect(() => {
    if (!openCode) return;
    window.scrollTo({ top: 0 });
  }, [openCode]);

  function applyVote(photo: PublicPhoto) {
    const next = photosRef.current.map((item) => (item.id === photo.id ? { ...item, voteCount: photo.voteCount } : item));
    photosRef.current = next;
    setPhotos(next);
  }

  if (openCode) {
    return (
      <div className="pt-1 md:mx-auto md:w-full md:max-w-[26rem] md:pt-0">
        <PhotoDetail
          code={openCode}
          onBack={() => setOpenCode(null)}
          onEnter={onEnter}
          onUpdated={(photo) => applyVote(photo)}
        />
      </div>
    );
  }

  const prizes = photos.slice(0, PRIZE_RANKS);
  const rest = photos.slice(PRIZE_RANKS);

  return (
    <div className="pt-1">
      <h1 className="text-center font-heading text-[1.85rem] leading-none tracking-wide uppercase">Top picks.</h1>
      <p className="mt-2 text-center text-sm text-[#274b3a]/75">The top two win free coffee for a month.</p>

      {status === "loading" ? (
        <div role="status" className="mt-4">
          <p className="sr-only">Loading top picks</p>
          <div className="grid grid-cols-2 gap-3 md:gap-5">
            <div className="aspect-[3/4] animate-pulse rounded-2xl bg-[#e7e4de]" />
            <div className="aspect-[3/4] animate-pulse rounded-2xl bg-[#e7e4de]" />
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-5">
            {prizes.map((photo, index) => (
              <PickCard key={photo.id} photo={photo} rank={index + 1} yours={mineIds.has(photo.id)} onOpen={setOpenCode} />
            ))}
          </div>
          {rest.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 md:mt-8 md:grid-cols-4 md:gap-4">
              {rest.map((photo, index) => (
                <PickCard key={photo.id} photo={photo} rank={index + PRIZE_RANKS + 1} yours={mineIds.has(photo.id)} onOpen={setOpenCode} />
              ))}
            </div>
          ) : null}
          {hasMore ? (
            <div ref={sentinelRef} className="mt-4 grid grid-cols-2 gap-3" aria-hidden={loadingMore ? undefined : true}>
              {loadingMore ? (
                <>
                  <p className="sr-only" role="status">
                    Loading more photos
                  </p>
                  <div className="aspect-[3/4] animate-pulse rounded-2xl bg-[#e7e4de]" />
                  <div className="aspect-[3/4] animate-pulse rounded-2xl bg-[#e7e4de]" />
                </>
              ) : (
                <div className="col-span-2 h-8" />
              )}
            </div>
          ) : null}
          {moreError ? (
            <div role="alert" className="py-4 text-center">
              <p className="text-sm">{moreError}</p>
              <Button
                type="button"
                className="mt-3 h-11 rounded-full bg-[#274b3a] px-5 text-[#f3f2ef]"
                onClick={() => {
                  setMoreError("");
                  hasMoreRef.current = true;
                  setHasMore(true);
                }}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
