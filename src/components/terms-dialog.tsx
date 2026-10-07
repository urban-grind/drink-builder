"use client";

import { useEffect, useRef } from "react";
import { ContestTermsBody } from "@/components/contest-terms";

export function TermsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Contest terms"
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
        <div className="flex h-[min(92dvh,100%)] w-full flex-col overflow-hidden bg-[#f3f2ef] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-[#274b3a]/12 bg-[#f3f2ef] px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#274b3a]"
            >
              <CloseMark />
            </button>
            <button type="button" onClick={onClose} className="h-11 rounded-full px-4 text-sm font-semibold text-[#274b3a]">
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ContestTermsBody />
          </div>
        </div>
      </div>
    </dialog>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
