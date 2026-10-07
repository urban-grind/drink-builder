"use client";

import { useEffect, useRef } from "react";

export function VoteCountedDialog({
  open,
  name,
  onClose,
  onSwipe,
  onEnter,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onSwipe: () => void;
  onEnter: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const swipeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => swipeRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="vote-counted-title"
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
        <div className="w-full rounded-t-3xl bg-[#f7f4ec] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#274b3a]/15 sm:hidden" />
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 id="vote-counted-title" className="text-xl font-semibold text-balance text-[#274b3a]">
              {name ? `You voted for ${name}!` : "You voted!"}
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
          <button
            ref={swipeRef}
            type="button"
            onClick={onSwipe}
            className="h-12 w-full rounded-full bg-[#274b3a] px-6 text-base font-semibold text-[#f3f2ef]"
          >
            Start swiping
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="mt-2 h-12 w-full rounded-full border border-[#274b3a]/25 bg-white px-6 text-base font-semibold text-[#274b3a]"
          >
            Enter your photo
          </button>
        </div>
      </div>
    </dialog>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
