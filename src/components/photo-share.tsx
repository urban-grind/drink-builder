"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadPhotoInstagramPng } from "@/lib/photo-instagram-png";
import type { InstagramSize } from "@/lib/instagram-png";

export function PhotoShare({
  drinkName,
  photoUrl,
  entryPath,
}: {
  drinkName: string;
  photoUrl: string;
  entryPath: string;
}) {
  const linkId = useId();
  const [href, setHref] = useState(entryPath);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<InstagramSize | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHref(`${window.location.origin}${entryPath}`);
  }, [entryPath]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      const field = document.getElementById(linkId) as HTMLInputElement | null;
      field?.focus();
      field?.select();
      setCopied(false);
    }
  }

  async function save(size: InstagramSize) {
    if (pending) return;
    setPending(size);
    setError(null);
    try {
      await downloadPhotoInstagramPng({ drinkName, photoUrl }, size);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The picture didn't save.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={linkId} className="text-sm font-bold">
        Your link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={linkId}
          readOnly
          value={href}
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-full border border-[#d5d1c9] bg-[#f3f2ef] px-4 text-sm"
        />
        <Button type="button" variant="outline" className="h-11 rounded-full px-4" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-4"
          disabled={pending !== null}
          onClick={() => void save("story")}
        >
          {pending === "story" ? "Saving…" : "Instagram story"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-4"
          disabled={pending !== null}
          onClick={() => void save("square")}
        >
          {pending === "square" ? "Saving…" : "Instagram square"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
