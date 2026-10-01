"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { PhotoLeaderboard } from "@/components/photo-leaderboard";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";

const THRESHOLD = 110;
const DECK_PAGE = 5;

type Flight = "drag" | "back" | "right" | "left" | "undo-right" | "undo-left" | "rest";

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function deckPath(voterId: string, except: string[]): string {
  const params = new URLSearchParams({ voterId, limit: String(DECK_PAGE) });
  if (except.length > 0) params.set("except", except.join(","));
  return `/api/photos/deck?${params.toString()}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function CardFace({ photo }: { photo: PublicPhoto }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbUrl}
        alt={photo.drinkName}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1a2e24] via-[#1a2e24]/80 to-transparent px-5 pt-16 pb-5 text-[#f3f2ef]">
        <p className="font-heading text-xl leading-tight">{photo.personName.trim()}</p>
        <time dateTime={photo.createdAt} className="mt-2 block text-lg font-bold">
          {shortDate(photo.createdAt)}
        </time>
        <p className="mt-2 text-sm text-[#f3f2ef]/80">{photo.drinkName}</p>
      </div>
    </>
  );
}

export function PhotoDeck() {
  const { voterId, ready } = useVoter();
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("The photos didn't load.");
  const [last, setLast] = useState<{ photo: PublicPhoto; action: "vote" | "skip" } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [flight, setFlight] = useState<Flight>("rest");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [screen, setScreen] = useState<"deck" | "board">("deck");
  const [hasMore, setHasMore] = useState(true);
  const photosRef = useRef<PublicPhoto[]>([]);
  const startX = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef<(action: "vote" | "skip") => void>(() => {});
  const canDragRef = useRef(false);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    requestJson<{ photos: PublicPhoto[] }>(deckPath(voterId, []), {
      signal: controller.signal,
    })
      .then((data) => {
        const seen = new Set<string>();
        const unique = data.photos.filter((photo) => {
          if (seen.has(photo.id)) return false;
          seen.add(photo.id);
          return true;
        });
        setPhotos(unique);
        setHasMore(data.photos.length === DECK_PAGE);
        setLast(null);
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The photos didn't load.");
      });
    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!ready || !voterId || status !== "ready" || !hasMore || photos.length > 3) return;
    const controller = new AbortController();
    const except = photosRef.current.map((photo) => photo.id);
    requestJson<{ photos: PublicPhoto[] }>(deckPath(voterId, except), { signal: controller.signal })
      .then((data) => {
        setPhotos((currentPhotos) => {
          const seen = new Set(currentPhotos.map((photo) => photo.id));
          const more = data.photos.filter((photo) => !seen.has(photo.id));
          return more.length > 0 ? [...currentPhotos, ...more] : currentPhotos;
        });
        if (data.photos.length < DECK_PAGE) setHasMore(false);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiRequestError ? caught.message : "The next photos didn't load.");
        setHasMore(false);
      });
    return () => controller.abort();
  }, [ready, voterId, status, hasMore, photos.length]);

  const current = photos[0] ?? null;
  const behind = photos[1] ?? null;
  const moving = flight === "drag" ? dragX : flight === "right" ? THRESHOLD : flight === "left" ? -THRESHOLD : dragX;
  const travel = Math.min(1, Math.abs(moving) / THRESHOLD);
  const like = flight === "right" ? 1 : Math.max(0, Math.min(1, dragX / THRESHOLD));
  const nope = flight === "left" ? 1 : Math.max(0, Math.min(1, -dragX / THRESHOLD));
  const offscreen = flight === "right" || flight === "undo-right" || flight === "left" || flight === "undo-left";
  const transform = offscreen
    ? `translateX(${flight.endsWith("right") ? "125%" : "-125%"}) rotate(${flight.endsWith("right") ? 16 : -16}deg)`
    : `translateX(${dragX}px) rotate(${dragX / 16}deg)`;
  const transition =
    flight === "drag" || flight === "undo-right" || flight === "undo-left"
      ? "none"
      : flight === "back"
        ? "transform 460ms cubic-bezier(0.34, 1.45, 0.64, 1)"
        : "transform 420ms cubic-bezier(0.18, 0.9, 0.28, 1.05)";

  function setDrag(next: number) {
    dragXRef.current = next;
    setDragX(next);
  }

  async function finish(action: "vote" | "skip") {
    if (!voterId || !current || busy) return;
    const photo = current;
    setBusy(true);
    setError("");
    startX.current = null;
    setFlight(action === "vote" ? "right" : "left");
    try {
      await Promise.all([
        wait(430),
        requestJson("/api/photos/deck", {
          method: "POST",
          body: JSON.stringify({ voterId, photoId: photo.id, action }),
        }),
      ]);
      setFlight("rest");
      setDrag(0);
      setPhotos((items) => items.filter((item) => item.id !== photo.id));
      setLast({ photo, action });
    } catch (caught) {
      setFlight("back");
      setDrag(0);
      setError(caught instanceof Error ? caught.message : "That swipe didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!voterId || !last || busy) return;
    const previous = last;
    setBusy(true);
    setError("");
    try {
      const data = await requestJson<{ photo: PublicPhoto; action: "vote" | "skip" }>("/api/photos/deck/undo", {
        method: "POST",
        body: JSON.stringify({ voterId, photoId: previous.photo.id }),
      });
      flushSync(() => {
        setDrag(0);
        setFlight(data.action === "vote" ? "undo-right" : "undo-left");
        setPhotos((items) => [data.photo, ...items.filter((item) => item.id !== data.photo.id)]);
        setLast(null);
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setFlight("rest"));
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That undo didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  finishRef.current = finish;
  canDragRef.current = Boolean(current) && !busy;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const card: HTMLDivElement = node;

    function onDown(event: PointerEvent) {
      if (event.button !== 0 || !canDragRef.current) return;
      startX.current = event.clientX;
      setFlight("drag");
      try {
        card.setPointerCapture(event.pointerId);
      } catch {
        // The card still follows the pointer if capture is unavailable.
      }
    }

    function onMove(event: PointerEvent) {
      if (startX.current === null) return;
      setDrag(event.clientX - startX.current);
    }

    function onUp() {
      if (startX.current === null) return;
      const distance = dragXRef.current;
      startX.current = null;
      if (distance > THRESHOLD) void finishRef.current("vote");
      else if (distance < -THRESHOLD) void finishRef.current("skip");
      else {
        setFlight("back");
        setDrag(0);
      }
    }

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
    return () => {
      card.removeEventListener("pointerdown", onDown);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onUp);
    };
  }, [status, current?.id]);

  return (
    <div className="relative left-1/2 flex w-screen max-w-[100vw] -translate-x-1/2 -mt-8 -mb-8 min-h-[calc(100dvh-4.5rem)] flex-col bg-[#f3f2ef] px-4 py-4 sm:-mt-12 sm:-mb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {screen === "board" ? <PhotoLeaderboard onBack={() => setScreen("deck")} /> : null}

        {screen === "deck" ? (
          <button
            type="button"
            onClick={() => setScreen("board")}
            className="!mb-3 !h-11 !w-full !rounded-full !border !border-[#274b3a] !bg-white !text-sm !font-bold !text-[#274b3a]"
          >
            Leaderboard
          </button>
        ) : null}

        {screen === "deck" && status === "loading" ? (
          <div role="status" className="flex flex-1 items-center justify-center">
            <p className="sr-only">Loading photos</p>
            <div className="aspect-[3/4] w-full animate-pulse rounded-[1.75rem] bg-[#e7e4de]" />
          </div>
        ) : null}

        {screen === "deck" && status === "error" ? (
          <div role="alert" className="m-auto max-w-sm text-center">
            <h1 className="font-heading text-4xl">The photos didn't load</h1>
            <p className="mt-3">{error}</p>
            <Button type="button" className="mt-6 h-12 rounded-full px-6" onClick={() => setReloadKey((value) => value + 1)}>
              Try again
            </Button>
          </div>
        ) : null}

        {screen === "deck" && status === "ready" && !current ? (
          <div className="m-auto max-w-sm text-center">
            <h1 className="font-heading text-4xl leading-tight text-balance">You're caught up</h1>
            <p className="mt-3 text-lg">Check back later for more.</p>
          </div>
        ) : null}

        {screen === "deck" && status === "ready" && current ? (
          <div className="relative mx-auto flex w-full flex-1 items-center">
            <div className="relative h-[min(72dvh,40rem)] w-full">
              {behind ? (
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem] bg-[#e7e4de] shadow-sm"
                  aria-hidden="true"
                  style={{
                    transform: `scale(${0.94 + 0.06 * travel}) translateY(${12 - 12 * travel}px)`,
                    transition: flight === "drag" ? "none" : "transform 420ms cubic-bezier(0.18, 0.9, 0.28, 1)",
                  }}
                >
                  <CardFace photo={behind} />
                </div>
              ) : null}
              <div
                ref={cardRef}
                className="absolute inset-0 z-10 touch-none select-none overflow-hidden rounded-[1.75rem] bg-[#274b3a] shadow-[0_18px_50px_rgb(39_75_58/0.22)]"
                style={{ transform, transition }}
              >
                <CardFace photo={current} />
                <div
                  className="pointer-events-none absolute inset-0 bg-[#2f9e5a]"
                  style={{ opacity: like * 0.38, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-[#d64545]"
                  style={{ opacity: nope * 0.38, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                />
                <div
                  className="pointer-events-none absolute top-8 left-6 -rotate-12 rounded-md border-4 border-[#2f9e5a] px-3 py-1 text-3xl font-bold tracking-wide text-[#2f9e5a]"
                  style={{ opacity: like, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                >
                  LIKE
                </div>
                <div
                  className="pointer-events-none absolute top-8 right-6 rotate-12 rounded-md border-4 border-[#d64545] px-3 py-1 text-3xl font-bold tracking-wide text-[#d64545]"
                  style={{ opacity: nope, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                >
                  NOPE
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {screen === "deck" && error && status === "ready" ? (
          <p role="alert" className="mt-3 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {screen === "deck" ? (
          <div className="mx-auto mt-4 flex w-full max-w-md items-center justify-between gap-3 pb-2">
          <button
            type="button"
            onClick={() => void finish("skip")}
            disabled={!current || busy}
            className="!h-14 !flex-1 !rounded-full !border !border-[#274b3a] !bg-white !text-base !font-bold !text-[#274b3a] disabled:!opacity-40"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void undo()}
            disabled={!last || busy}
            className="!h-14 !rounded-full !bg-transparent !px-4 !text-sm !font-bold !text-[#274b3a] disabled:!opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => void finish("vote")}
            disabled={!current || busy}
            className="!h-14 !flex-1 !rounded-full !bg-[#274b3a] !text-base !font-bold !text-[#f3f2ef] disabled:!opacity-40"
          >
            Vote
          </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
