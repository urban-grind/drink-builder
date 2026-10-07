"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoDetail } from "@/components/photo-detail";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { firstName } from "@/lib/first-name";
import type { ContestActivity, LeaderboardEntry, PublicPhoto } from "@/lib/photo-types";

const PAGE_SIZE = 4;

type LeaderboardPage = {
  photos: LeaderboardEntry[];
  hasMore: boolean;
  activity?: ContestActivity;
};

function countWord(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function pagePath(offset: number): string {
  const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
  return `/api/photos/leaderboard?${params.toString()}`;
}

function voteLabel(count: number): string {
  return `${count} ${count === 1 ? "vote" : "votes"}`;
}

function EntryMark() {
  return (
    <svg viewBox="0 0 56 48" aria-hidden="true" className="h-11 w-12 shrink-0">
      <rect x="6" y="10" width="30" height="26" rx="4" fill="#d7e2da" transform="rotate(-10 21 23)" />
      <rect x="16" y="6" width="32" height="30" rx="5" fill="#ffffff" />
      <path d="M20 28.5l7.2-7 5.2 5.2 3.4-2.6 7.2 7.2H20z" fill="#8eaa98" />
      <circle cx="38" cy="14" r="2" fill="#d5e0d8" />
    </svg>
  );
}

function VoteMark() {
  return (
    <svg viewBox="0 0 48 50" aria-hidden="true" className="h-11 w-11 shrink-0">
      <path d="M8 8h28a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H22l-8 8v-8H8a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" fill="#f6d8d1" />
      <path
        d="M24 30.2s-5.4-3.4-5.4-7c0-2.2 1.4-3.6 3.2-3.6 1 0 1.9.5 2.2 1.2.3-.7 1.2-1.2 2.2-1.2 1.8 0 3.2 1.4 3.2 3.6 0 3.6-5.4 7-5.4 7z"
        fill="#d16b62"
      />
    </svg>
  );
}

function CupArrow() {
  return (
    <svg viewBox="0 0 42 36" aria-hidden="true" className="h-8 w-9 shrink-0 text-[#6d8a7a]">
      <path d="M8 7c7 1 12 8 14 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 22.5 23 27l1.2-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActivityCards({ activity }: { activity: ContestActivity }) {
  return (
    <div className="mx-auto mt-5 max-w-md">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-1.5 rounded-[1.15rem] bg-[#e7f0ea] px-2.5 py-3 sm:gap-2.5 sm:px-3.5">
          <EntryMark />
          <div className="min-w-0 text-left">
            <p className="font-heading text-[1.85rem] leading-none tabular-nums text-[#274b3a]">{activity.photos}</p>
            <p className="mt-1 text-[10px] font-bold tracking-[0.14em] text-[#274b3a]">ENTRIES</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-[1.15rem] bg-[#fbf6ef] px-2.5 py-3 sm:gap-2.5 sm:px-3.5">
          <VoteMark />
          <div className="min-w-0 text-left">
            <p className="font-heading text-[1.85rem] leading-none tabular-nums text-[#274b3a]">{activity.votes}</p>
            <p className="mt-1 text-[10px] font-bold tracking-[0.12em] text-[#274b3a]">TOTAL VOTES</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-[#5d7468]">
        {countWord(activity.photosToday, "photo")} and {countWord(activity.votesToday, "vote")} today
      </p>
      <div className="mt-1 flex items-end justify-center gap-1">
        <CupArrow />
        <p className="pb-0.5 text-sm text-[#274b3a]/75">Your cup could be next.</p>
      </div>
    </div>
  );
}

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#274b3a]" fill="currentColor">
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
  const name = firstName(photo.personName);
  const place = rank === 1 ? "Number one" : rank === 2 ? "Number two" : `Rank ${rank}`;
  const label = [yours ? "Your photo" : null, place, name, voteLabel(photo.voteCount)]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      onClick={() => onOpen(photo.code)}
      disabled={!photo.code}
      aria-label={label}
      className="cursor-pointer border-0 bg-transparent p-0 text-left text-[#274b3a]"
    >
      <div
        className={`overflow-hidden rounded-[1.15rem] bg-[#fbfaf7] shadow-[0_8px_18px_rgb(39_75_58/0.08)] ring-1 ring-[#274b3a]/10 ${yours ? "outline outline-[3px] outline-offset-2 outline-[#274b3a]" : ""}`}
      >
        <div className="relative aspect-square bg-[#e7e4de]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl}
            alt=""
            loading={rank <= PAGE_SIZE ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
          />
          <span className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#f6f1e8] text-sm font-semibold text-[#274b3a] shadow-sm">
            {rank}
          </span>
          {yours ? (
            <span className="absolute top-2 right-2 rounded-full bg-[#274b3a] px-2 py-1 text-[10px] leading-none font-semibold text-[#f3f2ef]">
              Your photo
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-semibold text-[#274b3a]">{name}</p>
          </div>
          <p className="flex shrink-0 items-center gap-1 text-xs font-semibold">
            <HeartMark />
            {voteLabel(photo.voteCount)}
          </p>
        </div>
      </div>
    </button>
  );
}

export function PhotoLeaderboard({
  mine,
  revision,
  onEnter,
  onSwipe,
}: {
  mine: string[];
  revision: number;
  onEnter?: () => void;
  onSwipe?: () => void;
}) {
  const [photos, setPhotos] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [activity, setActivity] = useState<ContestActivity | null>(null);
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
        setActivity(data.activity ?? null);
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted || gen !== generation.current) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The leaderboard didn't load.");
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
          onSwipe={onSwipe}
          onUpdated={(photo) => applyVote(photo)}
        />
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="text-center">
        <h1 className="font-heading text-[2.35rem] leading-none tracking-wide text-[#274b3a] uppercase">Leaderboard.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-snug text-balance text-[#274b3a]/80">
          Help choose who wins free coffee for a month.
        </p>
        {activity ? (
          <ActivityCards activity={activity} />
        ) : (
          <p className="mt-4 text-sm text-[#274b3a]/70">Your cup could be next.</p>
        )}
        {onEnter ? (
          <button
            type="button"
            onClick={onEnter}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#274b3a] px-5 py-2.5 text-sm font-semibold text-[#f3f2ef]"
          >
            Enter your photo
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>

      {status === "loading" ? (
        <div role="status" className="mt-4">
          <p className="sr-only">Loading leaderboard</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="aspect-square animate-pulse rounded-[1.15rem] bg-[#e7e4de]" />
            <div className="aspect-square animate-pulse rounded-[1.15rem] bg-[#e7e4de]" />
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
        <div className="mt-5">
          <div className="flex items-center gap-3 text-[13px] text-[#274b3a]/55">
            <span className="h-px flex-1 bg-[#274b3a]/15" />
            <p>Tap a photo to view & vote</p>
            <span className="h-px flex-1 bg-[#274b3a]/15" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4 md:gap-4">
            {photos.map((photo, index) => (
              <PickCard key={photo.id} photo={photo} rank={index + 1} yours={mineIds.has(photo.id)} onOpen={setOpenCode} />
            ))}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden={loadingMore ? undefined : true}>
              {loadingMore ? (
                <>
                  <p className="sr-only" role="status">
                    Loading more photos
                  </p>
                  <div className="aspect-square animate-pulse rounded-[1.15rem] bg-[#e7e4de]" />
                  <div className="aspect-square animate-pulse rounded-[1.15rem] bg-[#e7e4de]" />
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
