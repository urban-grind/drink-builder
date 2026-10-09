"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { ContestHeader, EnterButton } from "@/components/contest-header";
import { ContestNav } from "@/components/contest-nav";
import { requestPour } from "@/components/pour-pause";
import { DrawEntryDialog } from "@/components/draw-entry-dialog";
import { MyPhotos } from "@/components/my-photos";
import { PhotoDetail } from "@/components/photo-detail";
import { PhotoFaq } from "@/components/photo-faq";
import { PhotoEntryForm } from "@/components/photo-entry-form";
import { PhotoEntryView, type OwnerEntry } from "@/components/photo-entry-view";
import { EntryCountdown } from "@/components/entry-countdown";
import { WaysToWinDialog } from "@/components/ways-to-win-dialog";
import { PhotoLeaderboard } from "@/components/photo-leaderboard";
import { useMyPhotoIds } from "@/components/use-contest-memory";
import { useDrawPrompt } from "@/components/use-draw-prompt";
import { useSwipeDemo } from "@/components/use-swipe-demo";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { trackContest } from "@/lib/contest-track";
import { photoEntryPath } from "@/lib/first-name";
import type { PublicPhoto } from "@/lib/photo-types";

const THRESHOLD = 110;
const DECK_PAGE = 5;

type Flight = "drag" | "back" | "right" | "left" | "undo-right" | "undo-left" | "rest";
type Screen = "vote" | "picks" | "mine" | "faq" | "upload" | "entry" | "entered";
type ReturnScreen = "vote" | "picks" | "mine" | "faq" | "entry" | "entered";
type TabId = "vote" | "mine" | "picks" | "faq";

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
  const name = photo.personName.trim();
  const drink = photo.drinkName.trim();
  const caption = photo.caption.trim();
  const showCaption = caption.length > 0 && caption !== drink;
  const alt = [drink, showCaption ? caption : ""].filter(Boolean).join(". ") || name || "Contest photo";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl}
        alt={alt}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-[#274b3a]">
        <div className="h-8 bg-gradient-to-t from-white/90 to-transparent" />
        <div className="bg-white/90 px-3.5 pt-1.5 pb-2.5">
          <p className="font-heading text-xl leading-tight font-bold">{name}</p>
          {drink ? <p className="mt-0.5 text-sm leading-snug font-normal">{drink}</p> : null}
          {showCaption ? <p className="mt-0.5 text-[13px] leading-snug text-pretty">{caption}</p> : null}
        </div>
      </div>
    </>
  );
}

export function PhotoDeck({ entryCode, drinkStats = false }: { entryCode?: string; drinkStats?: boolean }) {
  const router = useRouter();
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
  const [screen, setScreen] = useState<Screen>(entryCode ? "entry" : "vote");
  const [routeReady, setRouteReady] = useState(false);
  const [uploadBack, setUploadBack] = useState<ReturnScreen>("vote");
  const [entered, setEntered] = useState<OwnerEntry | null>(null);
  const [enteredVotes, setEnteredVotes] = useState(0);
  const [enteredRank, setEnteredRank] = useState<number | null>(null);
  const [enteredGap, setEnteredGap] = useState<number | null>(null);
  const [enteredFrom, setEnteredFrom] = useState<"upload" | "mine">("upload");
  const [votedNotice, setVotedNotice] = useState(false);
  const [waysOpen, setWaysOpen] = useState(false);
  const myPhotoIds = useMyPhotoIds();
  const draw = useDrawPrompt({
    voterId,
    ready,
    photoIds: myPhotoIds,
    asking: screen === "vote",
  });
  const photosRef = useRef<PublicPhoto[]>([]);
  const startX = useRef<number | null>(null);
  const gesture = useRef<{ x: number; y: number; mode: "pending" | "up" | "side" } | null>(null);
  const dragXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const pendingSwipeScroll = useRef(false);
  const arrowSwipe = useRef<number | null>(null);
  const finishRef = useRef<(action: "vote" | "skip") => void>(() => {});
  const canDragRef = useRef(false);
  const swipeLockedRef = useRef(false);
  const setDragRef = useRef<(value: number) => void>(() => {});
  const stopDemoRef = useSwipeDemo(
    screen === "vote" && status === "ready" && photos.length > 0 && !draw.open && !draw.required && !waysOpen,
    cardRef,
    (value) => setDragRef.current(value),
    setFlight,
  );

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

  const bar: "vote" | "mine" | "picks" | null =
    screen === "entry" || screen === "faq" || (screen === "upload" && uploadBack === "faq")
      ? null
      : screen === "mine" || screen === "entered" || (screen === "upload" && (uploadBack === "mine" || uploadBack === "entered"))
        ? "mine"
        : screen === "picks" || (screen === "upload" && uploadBack !== "vote")
          ? "picks"
          : "vote";
  const current = photos[0] ?? null;
  const next = photos[1] ?? null;
  const deeper = photos[2] ?? null;
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
  setDragRef.current = setDrag;

  async function finish(action: "vote" | "skip") {
    stopDemoRef.current();
    if (swipeLockedRef.current) {
      startX.current = null;
      setFlight("back");
      setDrag(0);
      draw.reopen();
      return;
    }
    if (!voterId || !current || busy) return;
    const photo = current;
    setBusy(true);
    setError("");
    setVotedNotice(false);
    startX.current = null;
    setFlight(action === "vote" ? "right" : "left");
    try {
      const [, data] = await Promise.all([
        wait(430),
        requestJson<{ swipes: number; known: boolean }>("/api/photos/deck", {
          method: "POST",
          body: JSON.stringify({ voterId, photoId: photo.id, action }),
        }),
      ]);
      setFlight("rest");
      setDrag(0);
      setPhotos((items) => items.filter((item) => item.id !== photo.id));
      setLast({ photo, action });
      setVotedNotice(action === "vote");
      setBoardRevision((value) => value + 1);
      draw.note(data.swipes, data.known);
    } catch (caught) {
      setFlight("back");
      setDrag(0);
      setError(caught instanceof Error ? caught.message : "That swipe didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (swipeLockedRef.current || !voterId || !last || busy) return;
    const previous = last;
    setBusy(true);
    setError("");
    try {
      const data = await requestJson<{ photo: PublicPhoto; action: "vote" | "skip"; swipes: number; known: boolean }>("/api/photos/deck/undo", {
        method: "POST",
        body: JSON.stringify({ voterId, photoId: previous.photo.id }),
      });
      flushSync(() => {
        setDrag(0);
        setFlight(data.action === "vote" ? "undo-right" : "undo-left");
        setPhotos((items) => [data.photo, ...items.filter((item) => item.id !== data.photo.id)]);
        setLast(null);
        setVotedNotice(false);
        setBoardRevision((value) => value + 1);
      });
      draw.note(data.swipes, data.known);
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
  swipeLockedRef.current = draw.required;
  canDragRef.current = Boolean(current) && !busy;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const card: HTMLDivElement = node;

    function onDown(event: PointerEvent) {
      if (event.button !== 0 || !canDragRef.current) return;
      gesture.current = { x: event.clientX, y: event.clientY, mode: "pending" };
      try {
        card.setPointerCapture(event.pointerId);
      } catch {
        // The card still follows the pointer if capture is unavailable.
      }
    }

    function onMove(event: PointerEvent) {
      const start = gesture.current;
      if (!start || start.mode === "up") return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (start.mode === "pending") {
        if (Math.hypot(dx, dy) < 10) return;
        if (dy < -12 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          start.mode = "up";
          return;
        }
        start.mode = "side";
        stopDemoRef.current();
        startX.current = start.x - dragXRef.current;
        setFlight("drag");
      }
      if (startX.current === null) return;
      setDrag(event.clientX - startX.current);
    }

    function onUp(event: PointerEvent) {
      const start = gesture.current;
      gesture.current = null;
      if (start?.mode === "up") {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (dy <= -64 && Math.abs(dy) > Math.abs(dx) * 1.2) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("upload") === "1") setScreen("upload");
    else if (params.get("picks") === "1") setScreen("picks");
    else if (params.get("mine") === "1") setScreen("mine");
    else if (params.get("faq") === "1") setScreen("faq");
    setRouteReady(true);
  }, []);

  useEffect(() => {
    if (!routeReady || !ready) return;
    if (screen === "vote") trackContest("visit", "vote");
    else if (screen === "picks") trackContest("visit", "leaderboard");
  }, [routeReady, ready, screen]);

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

  function scrollToSwipe(behavior: ScrollBehavior = "smooth") {
    const node = document.getElementById("swipe");
    if (!node) return;
    const header = document.querySelector("header");
    const offset = Math.ceil(header?.getBoundingClientRect().height ?? 96) + 12;
    const top = node.getBoundingClientRect().top + window.scrollY - offset;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(Math.max(0, top), max), behavior });
  }

  function scrollToIntro() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTab(tab: TabId, toSwipe = false) {
    if (screen === "entry") {
      requestPour();
      router.push(toSwipe ? "/#swipe" : tab === "vote" ? "/" : `/?${tab}=1`);
      return;
    }
    if (tab === "vote") {
      if (screen !== "vote") requestPour();
      if (window.location.search) router.replace("/", { scroll: false });
      setScreen("vote");
      if (toSwipe) {
        if (screen === "vote") scrollToSwipe();
        else pendingSwipeScroll.current = true;
      } else if (screen === "vote") {
        scrollToIntro();
      }
      return;
    }
    pendingSwipeScroll.current = false;
    if (screen !== tab) requestPour();
    router.replace(`/?${tab}=1`);
    setScreen(tab);
  }

  useEffect(() => {
    if (screen !== "vote") return;
    const fromHash = window.location.hash === "#swipe";
    if (!pendingSwipeScroll.current && !fromHash) return;
    let cancelled = false;
    const started = performance.now();
    // Changing tabs scrolls the page on its own, sometimes after the cards are already in place.
    // Keep putting the cards under the header until that settles.
    const frame = window.setInterval(() => {
      if (cancelled) return;
      if (performance.now() - started > 2500) {
        window.clearInterval(frame);
        pendingSwipeScroll.current = false;
        if (fromHash) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        return;
      }
      if (window.location.search) return;
      const node = document.getElementById("swipe");
      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 96;
      const gap = node ? node.getBoundingClientRect().top - headerHeight : 999;
      if (Math.abs(gap - 12) > 24) scrollToSwipe("auto");
      else pendingSwipeScroll.current = false;
    }, 80);
    return () => {
      cancelled = true;
      window.clearInterval(frame);
    };
  }, [screen]);

  return (
    <div className={`relative flex w-full flex-col ${screen === "vote" || screen === "picks" || screen === "entry" || screen === "entered" ? "min-h-dvh" : "h-dvh"}`}>
      <ContestHeader
        logo={
          <button type="button" onClick={() => goTab("vote")} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/urban-grind-logo.png" alt="Urban Grind Coffee Co." className="h-11 w-auto" />
          </button>
        }
        action={
          screen === "upload" ? (
            <button
              type="button"
              onClick={() => setScreen(uploadBack)}
              className="inline-flex items-center gap-1 py-1 text-sm font-semibold text-[#274b3a]"
            >
              <CloseMark />
              Close
            </button>
          ) : (
            <EnterButton
              onClick={() => {
                if (screen === "entry") {
                  router.push("/?upload=1");
                  return;
                }
                setUploadBack(screen);
                setScreen("upload");
              }}
            />
          )
        }
      />

      {screen === "vote" ? (
        <div className="mx-auto w-full max-w-[26rem] px-4 md:max-w-7xl md:px-10">
          <section className="grid grid-cols-1 pt-6 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-5.5rem)] md:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] md:items-center md:gap-x-20 md:pt-10 md:pb-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="relative order-3 mx-auto mt-5 w-full max-w-[22rem] md:order-none md:mt-0 md:w-full md:max-w-none md:justify-self-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/contest-snap.jpg"
                alt="Photographing an Urban Grind cup."
                className="h-[28rem] w-full rounded-[1.35rem] object-cover object-[center_42%] md:h-auto md:max-h-[min(40rem,72vh)] md:aspect-[3/4]"
              />
              <div className="absolute right-3 bottom-3 flex items-end gap-2">
                <div className="h-24 w-[4.5rem] overflow-hidden rounded-xl shadow-[0_10px_24px_rgb(39_75_58/0.28)] ring-2 ring-[#f7f4ec] md:h-32 md:w-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/photos/wall-drink.jpg"
                    alt="A customer holding an Urban Grind drink."
                    className="h-[250%] w-full max-w-none -translate-y-[62%] object-cover"
                  />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/photos/cup-beans.jpg"
                  alt="An Urban Grind cup."
                  className="h-28 w-20 rounded-xl object-cover object-top shadow-[0_10px_24px_rgb(39_75_58/0.28)] ring-2 ring-[#f7f4ec] md:h-36 md:w-28"
                />
              </div>
            </div>
            <div className="contents md:flex md:flex-col md:items-start md:justify-center">
              <div className="order-1 text-center md:order-none md:text-left">
                <h1 className="font-heading text-[1.75rem] leading-none tracking-wide uppercase md:text-6xl">Sip. Snap. Swipe.</h1>
                <h2 className="mx-auto mt-4 max-w-[16rem] font-heading text-xl leading-tight md:mx-0 md:mt-5 md:max-w-lg md:text-4xl">
                  Swiping that won&apos;t get you in trouble.
                </h2>
              </div>
              <EntryCountdown className="order-4 mx-auto mt-5 flex flex-col items-center md:order-none md:mx-0 md:items-start" />
              <div className="order-5 mx-auto mt-5 max-w-[22rem] space-y-3 text-center text-sm leading-relaxed text-[#274b3a]/80 md:order-none md:mx-0 md:mt-5 md:max-w-lg md:text-left md:text-lg">
                <p>
                  Snap your Urban Grind drink, upload your photo, and rally your friends to vote! Then join the fun! Swipe right for photos you love, left to skip.
                </p>
                <p>The two entries with the most votes on October 23rd win free coffee for a month!</p>
                <button
                  type="button"
                  onClick={() => setWaysOpen(true)}
                  className="font-semibold text-[#274b3a] underline underline-offset-2"
                >
                  View the ways to win →
                </button>
              </div>
              <div className="order-2 mt-5 flex flex-col items-center gap-3 md:order-none md:mt-8 md:flex-row md:flex-wrap md:items-center">
                <button
                  type="button"
                  onClick={() => {
                    setUploadBack("vote");
                    setScreen("upload");
                  }}
                  className="inline-flex rounded-full border border-[#274b3a] px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-[#274b3a] uppercase"
                >
                  Enter your photo
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSwipe()}
                  className="inline-flex rounded-full bg-[#274b3a] px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-[#f3f2ef] uppercase"
                >
                  Start swiping
                </button>
              </div>
            </div>
          </section>

          <div id="swipe" className="flex min-h-[calc(100dvh-6rem)] flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-5.5rem)] md:justify-center md:pb-20">
          <button
            type="button"
            aria-label="Back to the top"
            onClick={scrollToIntro}
            onPointerDown={(event) => {
              arrowSwipe.current = event.clientY;
            }}
            onPointerUp={(event) => {
              const start = arrowSwipe.current;
              arrowSwipe.current = null;
              if (start !== null && start - event.clientY > 24) scrollToIntro();
            }}
            className="mx-auto mb-2 flex h-11 w-11 touch-none items-center justify-center text-[#274b3a]/70"
          >
            <UpChevron />
          </button>
          <div className="mt-2 flex w-full items-center justify-center md:gap-10">
            <div className="hidden shrink-0 flex-col items-center gap-2 md:flex">
              <button
                type="button"
                aria-label="Skip"
                onClick={() => void finish("skip")}
                disabled={!current || busy}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-[#ddd8d0] bg-[#f7f6f3] text-[#274b3a] shadow-sm disabled:opacity-40"
              >
                <SkipMark />
              </button>
              <span className="text-sm font-medium text-[#274b3a]">Skip</span>
            </div>
          <div className="relative mx-auto aspect-[3/4] w-full md:mx-0 md:h-[min(72vh,40rem)] md:w-auto md:max-w-[30rem]">
            <div className="relative h-full w-full">
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
                {deeper ? (
                  <div
                    key={deeper.id}
                    className="pointer-events-none absolute inset-x-0 top-14 bottom-0 overflow-hidden rounded-[1.35rem] bg-[#e7e4de] shadow-[0_8px_18px_rgb(39_75_58/0.08)] ring-1 ring-[#274b3a]/10"
                    aria-hidden="true"
                    style={{
                      transform: `translateY(${-44 + 20 * travel}px) scale(${0.94 + 0.03 * travel})`,
                      transformOrigin: "center top",
                      transition: flight === "drag" || flight === "left" || flight === "right" ? "none" : "transform 420ms cubic-bezier(0.18, 0.9, 0.28, 1)",
                    }}
                  >
                    <CardFace photo={deeper} />
                  </div>
                ) : null}
                {next ? (
                  <div
                    key={next.id}
                    className="pointer-events-none absolute inset-x-0 top-14 bottom-0 overflow-hidden rounded-[1.35rem] bg-[#e7e4de] shadow-[0_10px_22px_rgb(39_75_58/0.1)] ring-1 ring-[#274b3a]/10"
                    aria-hidden="true"
                    style={{
                      transform: `translateY(${-24 + 24 * travel}px) scale(${0.97 + 0.03 * travel})`,
                      transformOrigin: "center top",
                      transition: flight === "drag" || flight === "left" || flight === "right" ? "none" : "transform 420ms cubic-bezier(0.18, 0.9, 0.28, 1)",
                    }}
                  >
                    <CardFace photo={next} />
                  </div>
                ) : null}
                <div
                  key={current.id}
                  ref={cardRef}
                  className="absolute inset-x-0 top-14 bottom-0 z-10 touch-none overflow-hidden rounded-[1.35rem] bg-[#e7e4de] shadow-[0_16px_40px_rgb(39_75_58/0.14)] ring-1 ring-[#274b3a]/10 select-none"
                  style={{ transform, transition }}
                >
                  <CardFace photo={current} />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[#2f9e5a]"
                    style={{ opacity: like * 0.38, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[#d64545]"
                    style={{ opacity: nope * 0.38, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-md border-4 border-[#2f9e5a] px-2 py-0.5 text-2xl font-bold tracking-wide text-[#2f9e5a]"
                    style={{ opacity: like, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                  >
                    VOTE
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-md border-4 border-[#d64545] px-2 py-0.5 text-2xl font-bold tracking-wide text-[#d64545]"
                    style={{ opacity: nope, transition: flight === "drag" ? "none" : "opacity 280ms ease" }}
                  >
                    NOPE
                  </div>
                </div>
              </>
            ) : null}
            </div>
          </div>
            <div className="hidden shrink-0 flex-col items-center gap-2 md:flex">
              <button
                type="button"
                aria-label="Vote"
                onClick={() => void finish("vote")}
                disabled={!current || busy}
                className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#274b3a] text-[#f3f2ef] shadow-[0_8px_18px_rgb(39_75_58/0.28)] disabled:opacity-40"
              >
                <HeartMark />
              </button>
              <span className="text-sm font-medium text-[#274b3a]">Vote</span>
            </div>
          </div>

          <p className="mt-2 hidden text-center text-[13px] text-[#274b3a]/60 md:block">Swipe right to vote. Swipe left to skip.</p>

          {error && status === "ready" ? (
            <p role="alert" className="mt-2 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {votedNotice ? (
            <p className="mt-3 text-center text-sm text-[#274b3a]">
              <span className="font-semibold">Vote counted.</span>{" "}
              <button
                type="button"
                onClick={() => {
                  setUploadBack("vote");
                  setScreen("upload");
                }}
                className="font-semibold underline underline-offset-2"
              >
                Want to win coffee too? Enter your photo
              </button>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void undo()}
            disabled={!last || busy || draw.required}
            className="mx-auto inline-flex items-center gap-1.5 py-1 text-[13px] font-medium text-[#274b3a]/45 disabled:opacity-35"
          >
            <UndoArrow />
            Undo
          </button>
          </div>
        </div>
      ) : null}

      {screen === "mine" && voterId ? (
        <div className="min-h-0 w-full flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-20">
          <MyPhotos
            voterId={voterId}
            ids={myPhotoIds}
            onUpload={() => {
              setUploadBack("mine");
              setScreen("upload");
            }}
            onOpen={(photo) => {
              setEntered({
                personName: photo.personName,
                drinkName: photo.drinkName,
                caption: photo.caption,
                photoUrl: photo.imageUrl,
                code: photo.code,
                createdAt: photo.createdAt,
                live: photo.status === "approved",
              });
              setEnteredVotes(photo.voteCount);
              setEnteredRank(photo.rank);
              setEnteredGap(photo.votesFromFirst);
              setEnteredFrom("mine");
              setScreen("entered");
            }}
          />
        </div>
      ) : null}

      {screen === "picks" ? (
        <div className="mx-auto w-full max-w-[26rem] px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:max-w-5xl md:px-10 md:pb-20">
          <PhotoLeaderboard
            mine={myPhotoIds}
            revision={boardRevision}
            onEnter={() => {
              setUploadBack("picks");
              setScreen("upload");
            }}
            onSwipe={() => goTab("vote", true)}
          />
        </div>
      ) : null}

      {screen === "upload" ? (
        <div className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pt-4 pb-8 md:max-w-[500px] md:px-0 md:pb-16">
          <h1 className="text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase">Enter your photo</h1>
          <div className="mt-6">
            <PhotoEntryForm
              presentation="shell"
              active
              onBack={() => setScreen(uploadBack)}
              onEntered={(entry) => {
                setEntered(entry);
                setEnteredVotes(0);
                setEnteredRank(null);
                setEnteredGap(null);
                setEnteredFrom("upload");
                setScreen("entered");
              }}
            />
          </div>
        </div>
      ) : null}

      {screen === "entry" && entryCode ? (
        <div className="mx-auto w-full max-w-[26rem] px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-20">
          <PhotoDetail
            code={entryCode}
            onBack={() => router.push("/?picks=1")}
            onEnter={() => router.push("/?upload=1")}
            onSwipe={() => router.push("/#swipe")}
          />
        </div>
      ) : null}

      {screen === "faq" ? (
        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <PhotoFaq />
        </div>
      ) : null}

      {screen === "entered" && entered ? (
        <div className="mx-auto w-full max-w-[26rem] px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-20">
          <PhotoEntryView
            mode="owner"
            personName={entered.personName}
            drinkName={entered.drinkName}
            caption={entered.caption}
            photoUrl={entered.photoUrl}
            voteCount={enteredVotes}
            rank={enteredRank}
            votesFromFirst={enteredGap}
            createdAt={entered.createdAt}
            entryPath={photoEntryPath(entered.code)}
            live={entered.live}
            backLabel={enteredFrom === "mine" ? "My Entries" : "Leaderboard"}
            onBack={() => setScreen(enteredFrom === "mine" ? "mine" : "picks")}
          />
        </div>
      ) : null}

      {screen !== "upload" ? (
        <ContestNav current={bar} showDrinks={drinkStats} onSelect={(tab) => goTab(tab, tab === "vote")} />
      ) : null}

      {voterId ? (
        <DrawEntryDialog open={draw.open} required={draw.required} voterId={voterId} onDismiss={draw.dismiss} onSaved={draw.saved} />
      ) : null}
      <WaysToWinDialog
        open={waysOpen}
        onClose={() => setWaysOpen(false)}
        onFaq={() => {
          setWaysOpen(false);
          goTab("faq");
        }}
      />
    </div>
  );
}

function UpChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14l6-6 6 6" />
    </svg>
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 md:h-7 md:w-7" fill="currentColor">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
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
