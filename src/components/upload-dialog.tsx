"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PhotoEntryForm } from "@/components/photo-entry-form";

const UploadDialogContext = createContext<(() => void) | null>(null);

export function useUploadDialog(): () => void {
  const open = useContext(UploadDialogContext);
  if (!open) return () => {};
  return open;
}

export function OpenUploadButton({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const openUpload = useUploadDialog();
  return (
    <button type="button" onClick={openUpload} className={className}>
      {children}
    </button>
  );
}

export function UploadDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openUpload() {
    if (!open) setSession((value) => value + 1);
    setOpen(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upload") === "1" && window.location.pathname !== "/") setOpen(true);
  }, []);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <UploadDialogContext.Provider value={openUpload}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="upload-cup-title"
        className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[#274b3a]/50"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div
          className="flex min-h-full items-stretch justify-center sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-full w-full flex-col overflow-y-auto bg-[#f3f2ef] sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl sm:shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-6">
              <h2 id="upload-cup-title" className="font-heading text-3xl leading-none text-[#274b3a]">
                Upload your cup
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-2 text-sm font-bold text-[#274b3a]"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-5 sm:px-6 sm:pb-6">
              <PhotoEntryForm key={session} presentation="dialog" active={open} onFinished={() => setOpen(false)} />
            </div>
          </div>
        </div>
      </dialog>
    </UploadDialogContext.Provider>
  );
}
