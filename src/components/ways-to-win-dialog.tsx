"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { contestDaysLeftLabel, contestTimeLeft, type ContestTimeLeft } from "@/lib/contest-clock";
import { deliverPng, phoneSharesPng } from "@/lib/share-png";

const STORY_URL = "/coming-soon/sip-snap-swipe.png?v=6";
const STORY_FILE = "Urban-Grind-Story.png";

export function WaysToWinDialog({ open, onClose, onFaq }: { open: boolean; onClose: () => void; onFaq: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [left, setLeft] = useState<ContestTimeLeft | null>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const tick = () => setLeft(contestTimeLeft(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const daysLeft = left ? contestDaysLeftLabel(left) : "Days left";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="ways-to-win-title"
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[#274b3a]/45"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-full items-end justify-center sm:items-center sm:p-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[#f7f4ec] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-3xl sm:rounded-3xl sm:p-6">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#274b3a]/15 sm:hidden" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="ways-to-win-title" className="font-heading text-[1.85rem] leading-tight font-semibold text-[#274b3a]">
              Four ways to win.
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#274b3a]"
            >
              <CloseMark />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WayCard
              number="01"
              aside={daysLeft}
              title="Get the most votes"
              copy="Upload your Urban Grind drink photo and get your friends voting. The photo with the most votes wins."
              tag="Photo contest winner"
              icon={<CameraMark />}
            />
            <WayCard
              number="02"
              aside="Picked Oct 26th"
              title="Catch our eye"
              copy="Our team will choose a favourite photo to win free coffee for a month."
              tag="UG favourite winner"
              icon={<StarMark />}
            />
            <WayCard
              number="03"
              aside={daysLeft}
              title="Swipe for a chance to win"
              copy="Swipe right for photos you love, left to skip. Every swipe counts as one entry into our draw. One entry per photo reviewed."
              tag="Voting draw winner"
              icon={<SwipeMark />}
            />
            <WayCard
              number="04"
              aside="Live"
              live
              title="Share to your story"
              copy="Share the contest to your Instagram story and tag us. Each share counts as one entry into our sharing draw."
              tag="Sharing draw winner"
              icon={<SendMark />}
              action={<StoryButton />}
            />
          </div>
          <button
            type="button"
            onClick={onFaq}
            className="mt-4 h-11 w-full rounded-full border border-[#274b3a] bg-transparent text-sm font-bold text-[#274b3a]"
          >
            FAQs
          </button>
        </div>
      </div>
    </dialog>
  );
}

function WayCard({
  number,
  aside,
  live = false,
  title,
  copy,
  tag,
  icon,
  action,
}: {
  number: string;
  aside: string;
  live?: boolean;
  title: string;
  copy: string;
  tag: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className={`rounded-[1.15rem] px-4 pt-4 pb-4 text-left shadow-[0_10px_24px_rgb(39_75_58/0.07)] ${live ? "bg-[#d8f3e0]" : "bg-white"}`}>
      <div className="flex items-center justify-between gap-3 text-[#274b3a]">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-xs font-bold tracking-wide text-[#274b3a]/40">{number}</span>
          {live ? (
            <span className="inline-flex items-center gap-1 text-[0.68rem] font-bold tracking-[0.08em] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-[#274b3a]" aria-hidden="true" />
              {aside}
            </span>
          ) : (
            <span className="truncate text-[0.68rem] font-bold text-[#274b3a]/80">{aside}</span>
          )}
        </span>
        {icon}
      </div>
      <h3 className="mt-2.5 text-[1.05rem] leading-tight font-semibold">{title}</h3>
      <p className="mt-1.5 text-[0.92rem] leading-snug text-[#3e5c4d]">{copy}</p>
      <p className="mt-3 text-[0.68rem] font-bold tracking-[0.08em] uppercase">{tag}</p>
      {action}
    </article>
  );
}

function StoryButton() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const response = await fetch(STORY_URL);
      if (!response.ok) throw new Error("missing");
      const blob = await response.blob();
      await deliverPng(blob, STORY_FILE, phoneSharesPng());
    } catch (caught) {
      setNote(caught instanceof Error && caught.message !== "missing" ? caught.message : "The story didn't open. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        aria-busy={busy}
        className="mt-3 h-11 w-full rounded-full bg-[#274b3a] px-4 text-[0.82rem] font-bold text-[#f7f4ec] disabled:opacity-65"
      >
        Download the story
      </button>
      {note ? <p className="mt-2 text-center text-[0.78rem] leading-snug text-[#5d7468]">{note}</p> : null}
    </>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function CameraMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 8.5h3.2l1.4-2h6.8l1.4 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.2" r="3.1" />
    </svg>
  );
}

function StarMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3.6l2.2 4.8 5.3.7-3.9 3.6.9 5.3L12 15.6 7.5 18l.9-5.3L4.5 9.1l5.3-.7z" />
    </svg>
  );
}

function SwipeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8h11M15 5l3 3-3 3" />
      <path d="M17 16H6M9 13l-3 3 3 3" />
    </svg>
  );
}

function SendMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4.5 11.2 20 4.5l-6 15.2-2.5-6.2z" />
      <path d="M11.5 13.5 20 4.5" />
    </svg>
  );
}
