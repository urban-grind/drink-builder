"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { MyPhotos } from "@/components/my-photos";
import { PhotoDetail } from "@/components/photo-detail";
import { PhotoFaq } from "@/components/photo-faq";
import { PhotoEntryForm } from "@/components/photo-entry-form";
import { PhotoEntryView, type OwnerEntry } from "@/components/photo-entry-view";
import { PhotoLeaderboard } from "@/components/photo-leaderboard";
import { useMyPhotoIds } from "@/components/use-contest-memory";
import { useSwipeDemo } from "@/components/use-swipe-demo";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { photoEntryPath } from "@/lib/first-name";
import type { PublicPhoto } from "@/lib/photo-types";

const THRESHOLD = 110;
const DECK_PAGE = 5;

type Flight = "drag" | "back" | "right" | "left" | "undo-right" | "undo-left" | "rest";
type Screen = "vote" | "picks" | "mine" | "faq" | "upload" | "entry" | "entered";
type ReturnScreen = "vote" | "picks" | "mine" | "faq" | "entry" | "entered";
type TabId = "vote" | "mine" | "picks" | "faq";

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
        src={photo.imageUrl}
        alt={photo.drinkName}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-3.5 pt-16 pb-3.5 text-white">
        <p className="text-[12px] leading-tight font-medium text-white/90">
          {name}
          {date ? ` · ${date}` : ""}
        </p>
        <p className="mt-0.5 text-[15px] leading-tight font-medium">{photo.drinkName}</p>
      </div>
    </>
  );
}

export function PhotoDeck({ entryCode }: { entryCode?: string }) {
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
  const [uploadBack, setUploadBack] = useState<ReturnScreen>("vote");
  const [entered, setEntered] = useState<OwnerEntry | null>(null);
  const myPhotoIds = useMyPhotoIds();
  const photosRef = useRef<PublicPhoto[]>([]);
  const startX = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef<(action: "vote" | "skip") => void>(() => {});
  const canDragRef = useRef(false);
  const setDragRef = useRef<(value: number) => void>(() => {});
  const stopDemoRef = useSwipeDemo(
    screen === "vote" && status === "ready" && photos.length > 0,
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

  const bar: TabId =
    screen === "mine" || screen === "entered" || (screen === "upload" && (uploadBack === "mine" || uploadBack === "entered"))
      ? "mine"
      : screen === "faq" || (screen === "upload" && uploadBack === "faq")
        ? "faq"
        : screen === "picks" || screen === "entry" || (screen === "upload" && uploadBack !== "vote")
          ? "picks"
          : "vote";
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
  setDragRef.current = setDrag;

  async function finish(action: "vote" | "skip") {
    stopDemoRef.current();
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
      stopDemoRef.current();
      startX.current = event.clientX - dragXRef.current;
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("upload") === "1") setScreen("upload");
    else if (params.get("picks") === "1") setScreen("picks");
    else if (params.get("mine") === "1") setScreen("mine");
    else if (params.get("faq") === "1") setScreen("faq");
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

  function goTab(tab: TabId) {
    if (screen === "entry") {
      router.push(tab === "vote" ? "/" : `/?${tab}=1`);
      return;
    }
    if (tab === "vote") {
      if (window.location.search) router.replace("/");
      setScreen("vote");
      return;
    }
    router.replace(`/?${tab}=1`);
    setScreen(tab);
  }

  return (
    <div className="relative flex h-dvh w-full flex-col">
      <header className="shrink-0 border-b border-[#274b3a]/12">
        <div className="mx-auto flex w-full max-w-[26rem] items-center justify-between gap-4 px-5 pt-4 pb-3.5 md:max-w-6xl md:px-10 md:pt-6">
        <button type="button" onClick={() => goTab("vote")} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/urban-grind-logo.png" alt="Urban Grind Coffee Co." className="h-11 w-auto" />
        </button>
        <nav aria-label="Contest" className="hidden items-center gap-1 md:flex">
          <ScreenTab current={bar === "vote"} onClick={() => goTab("vote")} label="Vote">
            <TabHeart filled={bar === "vote"} />
          </ScreenTab>
          <ScreenTab current={bar === "mine"} onClick={() => goTab("mine")} label="My Photo">
            <PhotoMark filled={bar === "mine"} />
          </ScreenTab>
          <ScreenTab current={bar === "picks"} onClick={() => goTab("picks")} label="Top picks">
            <TrophyMark />
          </ScreenTab>
          <ScreenTab current={bar === "faq"} onClick={() => goTab("faq")} label="FAQ">
            <FaqMark />
          </ScreenTab>
        </nav>
        {screen === "upload" ? (
          <button
            type="button"
            onClick={() => setScreen(uploadBack)}
            className="inline-flex items-center gap-1 py-1 text-sm font-semibold text-[#274b3a]"
          >
            <CloseMark />
            Close
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (screen === "entry") {
                router.push("/?upload=1");
                return;
              }
              setUploadBack(screen);
              setScreen("upload");
            }}
            className="inline-flex items-center rounded-full border border-[#274b3a] bg-transparent px-3.5 py-2 text-sm font-semibold text-[#274b3a]"
          >
            + Upload
          </button>
        )}
        </div>
      </header>

      {screen === "vote" ? (
        <div className="mx-auto flex min-h-0 w-full max-w-[26rem] flex-1 flex-col px-4 pt-3 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:w-[400px] md:max-w-none md:px-0 md:pt-4 md:pb-4">
          <h1 className="text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase md:text-[1.65rem]">Sip. Snap. Swipe.</h1>
          <p className="mt-1 text-center text-sm text-[#274b3a]/80 md:mt-2">Swiping that won&apos;t get you in trouble.</p>
          <button
            type="button"
            onClick={() => {
              setUploadBack("vote");
              setScreen("upload");
            }}
            className="mx-auto mt-2 inline-flex rounded-full border border-[#274b3a] px-4 py-1.5 text-[11px] font-bold tracking-[0.12em] text-[#274b3a] uppercase md:mt-3"
          >
            Win free coffee for a month
          </button>
          <p className="mt-2 hidden text-center text-[13px] text-[#274b3a]/70 md:block">Upload your photo for a chance to win.</p>

          <div className="relative mx-auto mt-2 min-h-0 w-full flex-1 md:mt-4 md:h-[30rem] md:w-[400px] md:max-w-none md:flex-none">
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
                {behind ? (
                  <div
                    key={behind.id}
                    className="pointer-events-none absolute inset-x-2 top-0 bottom-4 overflow-hidden rounded-[1.35rem] bg-[#e7e4de] ring-1 ring-[#274b3a]/10"
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
                  className="absolute inset-x-0 top-1 bottom-0 z-10 touch-none overflow-hidden rounded-[1.35rem] bg-[#e7e4de] shadow-[0_16px_40px_rgb(39_75_58/0.14)] ring-1 ring-[#274b3a]/10 select-none"
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

          <p className="mt-2 hidden text-center text-[13px] text-[#274b3a]/60 md:block">Swipe right to vote. Swipe left to skip.</p>

          {error && status === "ready" ? (
            <p role="alert" className="mt-2 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-1.5 mb-0.5 flex items-end justify-center gap-8 md:mt-2 md:mb-2 md:gap-10">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                aria-label="Skip"
                onClick={() => void finish("skip")}
                disabled={!current || busy}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ddd8d0] bg-[#f7f6f3] text-[#274b3a] shadow-sm disabled:opacity-40 md:h-16 md:w-16"
              >
                <SkipMark />
              </button>
                <span className="text-xs font-medium text-[#274b3a] md:text-sm">Skip</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                aria-label="Vote"
                onClick={() => void finish("vote")}
                disabled={!current || busy}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#274b3a] text-[#f3f2ef] shadow-[0_8px_18px_rgb(39_75_58/0.28)] disabled:opacity-40 md:h-[4.5rem] md:w-[4.5rem]"
              >
                <HeartMark />
              </button>
                <span className="text-xs font-medium text-[#274b3a] md:text-sm">Vote</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void undo()}
            disabled={!last || busy}
            className="mx-auto inline-flex items-center gap-1.5 py-1 text-[13px] font-medium text-[#274b3a]/45 disabled:opacity-35"
          >
            <UndoArrow />
            Undo
          </button>
        </div>
      ) : null}

      {screen === "mine" && voterId ? (
        <div className="min-h-0 w-full flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4">
          <MyPhotos
            voterId={voterId}
            ids={myPhotoIds}
            onUpload={() => {
              setUploadBack("mine");
              setScreen("upload");
            }}
          />
        </div>
      ) : null}

      {screen === "picks" ? (
        <div data-scroll-root className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:max-w-5xl md:px-10 md:pb-4">
          <PhotoLeaderboard
            mine={myPhotoIds}
            revision={boardRevision}
            onEnter={() => {
              setUploadBack("picks");
              setScreen("upload");
            }}
          />
        </div>
      ) : null}

      {screen === "upload" ? (
        <div className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:max-w-[500px] md:px-0 md:pb-3">
          <h1 className="text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase">Your cup. Your shot.</h1>
          <p className="mt-2 text-center text-sm text-[#274b3a]/75">Got a great Urban Grind photo? Enter yours.</p>
          <p className="mx-auto mt-3 w-fit rounded-full border border-[#274b3a] px-4 py-1.5 text-[11px] font-bold tracking-[0.12em] text-[#274b3a] uppercase">
            Win free coffee for a month
          </p>
          <div className="mt-3">
            <PhotoEntryForm
              presentation="shell"
              active
              onBack={() => setScreen(uploadBack)}
              onEntered={(entry) => {
                setEntered(entry);
                setScreen("entered");
              }}
            />
          </div>
        </div>
      ) : null}

      {screen === "entry" && entryCode ? (
        <div className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <PhotoDetail
            code={entryCode}
            onBack={() => router.push("/?picks=1")}
            onEnter={() => router.push("/?upload=1")}
          />
        </div>
      ) : null}

      {screen === "faq" ? (
        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <PhotoFaq />
        </div>
      ) : null}

      {screen === "entered" && entered ? (
        <div className="mx-auto min-h-0 w-full max-w-[26rem] flex-1 overflow-y-auto px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <PhotoEntryView
            mode="owner"
            personName={entered.personName}
            drinkName={entered.drinkName}
            photoUrl={entered.photoUrl}
            voteCount={0}
            createdAt={entered.createdAt}
            entryPath={photoEntryPath(entered.code)}
            live={entered.live}
            onBack={() => setScreen("picks")}
          />
        </div>
      ) : null}

      <nav aria-label="Contest" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.45rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="pointer-events-auto grid w-full max-w-[22rem] grid-cols-4 rounded-full border border-[#274b3a]/10 bg-[#f7f6f3]/95 px-1 py-1 shadow-[0_8px_22px_rgb(39_75_58/0.16)] backdrop-blur-md">
          {(
            [
              ["vote", "Vote"],
              ["mine", "My Photo"],
              ["picks", "Top picks"],
              ["faq", "FAQ"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              aria-current={bar === tab ? "page" : undefined}
              onClick={() => goTab(tab)}
              className={`flex flex-col items-center gap-0.5 rounded-full px-1 py-1 text-[10px] leading-none font-semibold whitespace-nowrap ${bar === tab ? "bg-[#274b3a]/8 text-[#274b3a]" : "text-[#274b3a]/45"}`}
            >
              {tab === "vote" ? <TabHeart filled={bar === "vote"} /> : null}
              {tab === "mine" ? <PhotoMark filled={bar === "mine"} /> : null}
              {tab === "picks" ? <TrophyMark /> : null}
              {tab === "faq" ? <FaqMark /> : null}
              {label}
            </button>
          ))}
        </div>
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold ${current ? "bg-[#274b3a] text-[#f3f2ef]" : "text-[#274b3a]/55"}`}
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

function TabHeart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 md:h-5 md:w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}

function PhotoMark({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="14" rx="2" fill={filled ? "currentColor" : "none"} />
      <circle cx="9" cy="10" r="1.4" fill={filled ? "#f3f2ef" : "currentColor"} stroke="none" />
      <path d="M7 16l3.2-3.2a1 1 0 0 1 1.4 0L20 18" fill="none" stroke={filled ? "#f3f2ef" : "currentColor"} />
    </svg>
  );
}

function FaqMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.3.9-1.3 1.8" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function TrophyMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
