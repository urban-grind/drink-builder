"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { PhotoEntryForm } from "@/components/photo-entry-form";
import { PhotoLeaderboard } from "@/components/photo-leaderboard";
import { useMyPhotoIds } from "@/components/use-contest-memory";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";

const THRESHOLD = 110;
const DECK_PAGE = 5;

type Flight = "drag" | "back" | "right" | "left" | "undo-right" | "undo-left" | "rest";
type Screen = "vote" | "picks" | "upload";

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
  const date = shortDate(photo.createdAt);
  const name = photo.personName.trim();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbUrl}
        alt={photo.drinkName}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent px-3.5 pt-12 pb-3 text-white">
        <p className="text-[13px] leading-tight font-medium">
          {name}
          {date ? ` · ${date}` : ""}
        </p>
        <p className="mt-0.5 text-[12px] leading-tight font-normal text-white/90">{photo.drinkName}</p>
      </div>
    </>
  );
}

export function PhotoDeck() {
  const { voterId, ready } = useVoter();
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [last, setLast] = useState<{ photo: PublicPhoto; action: "vote" | "skip" } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [flight, setFlight] = useState<Flight>("rest");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [boardRevision, setBoardRevision] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [screen, setScreen] = useState<Screen>("vote");
  const myPhotoIds = useMyPhotoIds();
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
        setError("");
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
        setError("");
      })
      .catch((caught) => {
        if (controller.signal.aborted || (caught instanceof Error && caught.name === "AbortError")) return;
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
      setBoardRevision((value) => value + 1);
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
        setBoardRevision((value) => value + 1);
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
  }, [status, current?.id, screen]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upload") === "1") setScreen("upload");
  }, []);

  useEffect(() => {
    if (screen !== "vote") return;
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      finishRef.current(event.key === "ArrowRight" ? "vote" : "skip");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  return (
    <div className="flex h-dvh w-full flex-col">
      <header className={`mx-auto w-full max-w-[26rem] items-center justify-between gap-4 px-5 pt-4 pb-2 md:max-w-6xl md:px-10 md:pt-6 ${screen === "upload" ? "hidden md:flex" : "flex"}`}>
        <p className="font-heading text-[0.95rem] leading-[0.9] tracking-[0.16em] uppercase">
          Urban
          <br />
          Grind
        </p>
        <nav aria-label="Contest" className="hidden items-center gap-2 md:flex">
          <ScreenTab current={screen === "vote"} onClick={() => setScreen("vote")} label="Vote">
            <TabHeart filled={screen === "vote"} />
          </ScreenTab>
          <ScreenTab current={screen === "picks"} onClick={() => setScreen("picks")} label="Top picks">
            <TrophyMark />
          </ScreenTab>
        </nav>
        <button
          type="button"
          onClick={() => setScreen("upload")}
          className="inline-flex items-center rounded-full border border-[#274b3a] bg-transparent px-3.5 py-2 text-sm font-semibold text-[#274b3a]"
        >
          + Upload
        </button>
      </header>

      {screen === "vote" ? (
        <div className="mx-auto flex min-h-0 w-full max-w-[26rem] flex-1 flex-col px-5 pb-2 md:w-[400px] md:max-w-none md:px-0 md:pb-4">
          <h1 className="text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase md:text-[1.65rem]">Sip. Snap. Swipe.</h1>
          <p className="mt-2 text-center text-sm text-[#274b3a]/80">Swiping that won&apos;t get you in trouble.</p>
          <p className="mt-1.5 text-center text-[13px] leading-snug text-[#274b3a]/60">
            Vote for your favourite coffee photos. Swipe right to vote, left to skip.
          </p>

          <div className="relative mx-auto mt-3 min-h-0 w-full max-w-[22rem] flex-1 md:mt-4 md:w-[400px] md:max-w-none">
            {status === "loading" ? (
              <div role="status" className="absolute inset-3">
                <p className="sr-only">Loading photos</p>
                <div className="h-full animate-pulse rounded-[1.6rem] bg-[#e7e4de]" />
              </div>
            ) : null}

            {status === "error" ? (
              <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                <h2 className="font-heading text-3xl">The photos didn&apos;t load</h2>
                <p className="mt-3 text-sm">{error}</p>
                <Button type="button" className="mt-6 h-12 rounded-full bg-[#274b3a] px-6 text-[#f3f2ef]" onClick={() => setReloadKey((value) => value + 1)}>
                  Try again
                </Button>
              </div>
            ) : null}

            {status === "ready" && !current ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                <h2 className="font-heading text-3xl leading-tight text-balance">You&apos;re caught up</h2>
                <p className="mt-3 text-base">Check back later for more.</p>
              </div>
            ) : null}

            {status === "ready" && current ? (
              <>
                {behind ? (
                  <div
                    key={behind.id}
                    className="pointer-events-none absolute inset-x-0 top-0 bottom-8 overflow-hidden rounded-[1.5rem] bg-[#e7e4de]"
                    aria-hidden="true"
                    style={{
                      transform: `scale(${0.985 + 0.015 * travel})`,
                      transformOrigin: "center top",
                      transition: flight === "drag" || flight === "left" || flight === "right" ? "none" : "transform 420ms cubic-bezier(0.18, 0.9, 0.28, 1)",
                    }}
                  >
                    <CardFace photo={behind} />
                  </div>
                ) : null}
                <div
                  key={current.id}
                  ref={cardRef}
                  className="absolute inset-x-0 top-8 bottom-0 z-10 touch-none overflow-hidden rounded-[1.6rem] bg-[#274b3a] shadow-[0_16px_40px_rgb(39_75_58/0.16)] select-none"
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
                    className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-md border-4 border-[#2f9e5a] px-2 py-0.5 text-2xl font-bold tracking-wide text-[#2f9e5a]"
                    style={{ opacity: like, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                  >
                    LIKE
                  </div>
                  <div
                    className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-md border-4 border-[#d64545] px-2 py-0.5 text-2xl font-bold tracking-wide text-[#d64545]"
                    style={{ opacity: nope, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                  >
                    NOPE
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {error && status === "ready" ? (
            <p role="alert" className="mt-2 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void undo()}
            disabled={!last || busy}
            className="mx-auto mt-2 inline-flex items-center gap-1.5 py-1 text-[13px] font-medium text-[#274b3a]/45 disabled:opacity-35"
          >
            <UndoArrow />
            Undo
          </button>

          <div className="mt-1 mb-1 flex items-center justify-center gap-10 md:mb-2">
            <button
              type="button"
              aria-label="Skip"
              onClick={() => void finish("skip")}
              disabled={!current || busy}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-[#ddd8d0] bg-[#f7f6f3] text-[#274b3a] shadow-sm disabled:opacity-40"
            >
              <SkipMark />
            </button>
            <button
              type="button"
              aria-label="Vote"
              onClick={() => void finish("vote")}
              disabled={!current || busy}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#274b3a] text-[#f3f2ef] shadow-[0_10px_24px_rgb(39_75_58/0.28)] disabled:opacity-40"
            >
              <HeartMark />
            </button>
          </div>
          <p className="mb-1 hidden text-center text-[12px] text-[#274b3a]/45 md:block">← Skip · Vote →</p>
        </div>
      ) : null}

      {screen === "picks" ? (
        <div className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pb-4 md:max-w-5xl md:px-10">
          <PhotoLeaderboard mine={myPhotoIds} revision={boardRevision} />
        </div>
      ) : null}

      {screen === "upload" ? (
        <div className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pt-3 pb-4 md:max-w-[500px] md:px-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setScreen("vote")}
              className="inline-flex items-center gap-1 py-1 text-sm font-semibold text-[#274b3a]"
            >
              <CloseMark />
              Close
            </button>
          </div>
          <h1 className="mt-1 text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase">Your cup. Your shot.</h1>
          <p className="mt-2 text-center text-sm text-[#274b3a]/75">Got a great Urban Grind photo? Enter yours.</p>
          <div className="mt-4">
            <PhotoEntryForm presentation="shell" active onBack={() => setScreen("vote")} />
          </div>
        </div>
      ) : null}

      <nav aria-label="Contest" className="grid shrink-0 grid-cols-2 border-t border-[#274b3a]/10 bg-[#f3f2ef] px-4 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] md:hidden">
        <button
          type="button"
          aria-current={screen === "vote" ? "page" : undefined}
          onClick={() => setScreen("vote")}
          className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${screen === "vote" ? "text-[#274b3a]" : "text-[#274b3a]/40"}`}
        >
          <TabHeart filled={screen === "vote"} />
          Vote
        </button>
        <button
          type="button"
          aria-current={screen === "picks" ? "page" : undefined}
          onClick={() => setScreen("picks")}
          className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${screen === "picks" ? "text-[#274b3a]" : "text-[#274b3a]/40"}`}
        >
          <TrophyMark />
          Top picks
        </button>
      </nav>
    </div>
  );
}

function ScreenTab({
  current,
  onClick,
  label,
  children,
}: {
  current: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold ${current ? "bg-[#274b3a] text-[#f3f2ef]" : "text-[#274b3a]/55"}`}
    >
      {children}
      {label}
    </button>
  );
}

function UndoArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H12" />
    </svg>
  );
}

function SkipMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="currentColor">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}

function TabHeart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}

function TrophyMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v2.5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5.2A2.2 2.2 0 0 0 7.2 10" />
      <path d="M16 6h2.8A2.2 2.2 0 0 1 16.8 10" />
      <path d="M12 12.5V16" />
      <path d="M9 20h6" />
      <path d="M10 16h4v2a2 2 0 0 1-4 0v-2z" />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
