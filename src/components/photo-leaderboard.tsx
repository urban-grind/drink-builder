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
  onOpen,
}: {
  photo: LeaderboardEntry;
  rank: number;
  yours: boolean;
  prominent: boolean;
  onOpen: (code: string) => void;
}) {
  const date = shortDate(photo.createdAt);
  const name = photo.personName.trim();
  return (
    <button
      type="button"
      onClick={() => onOpen(photo.code)}
      disabled={!photo.code}
      aria-label={yours ? `Your photo, rank ${rank}, ${photo.drinkName}` : `${photo.drinkName}, rank ${rank}`}
      className={`cursor-pointer border-0 bg-transparent p-0 text-left text-[#274b3a] ${prominent ? "col-span-2 md:col-span-1" : ""}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl bg-[#e7e4de] ${prominent ? "aspect-[4/5] md:aspect-[3/4]" : "aspect-[3/4]"} ${yours ? "outline outline-[3px] outline-offset-2 outline-[#274b3a]" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbUrl}
          alt=""
          loading={rank <= PAGE_SIZE ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
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
    const root = node.closest("[data-scroll-root]");
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
      { root: root instanceof Element ? root : null, rootMargin: "160px 0px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [status, hasMore, photos.length]);

  useEffect(() => {
    if (!openCode) return;
    document.querySelector("[data-scroll-root]")?.scrollTo({ top: 0 });
  }, [openCode]);

  function applyVote(photo: PublicPhoto) {
    const next = photosRef.current.map((item) => (item.id === photo.id ? { ...item, voteCount: photo.voteCount } : item));
    photosRef.current = next;
    setPhotos(next);
  }

  if (openCode) {
    return (
      <div className="pt-1">
        <PhotoDetail
          code={openCode}
          onBack={() => setOpenCode(null)}
          onEnter={onEnter}
          onUpdated={(photo) => applyVote(photo)}
        />
      </div>
    );
  }

  const lead = photos.slice(0, 3);
  const rest = photos.slice(3);

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
            {lead.map((photo, index) => (
              <PickCard key={photo.id} photo={photo} rank={index + 1} prominent={index === 0} yours={mineIds.has(photo.id)} onOpen={setOpenCode} />
            ))}
          </div>
          {rest.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 md:mt-8 md:grid-cols-4 md:gap-4">
              {rest.map((photo, index) => (
                <PickCard key={photo.id} photo={photo} rank={index + 4} prominent={false} yours={mineIds.has(photo.id)} onOpen={setOpenCode} />
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
