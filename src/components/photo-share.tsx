"use client";

import { useEffect, useId, useState } from "react";
import { InstagramImageButtons } from "@/components/instagram-image-buttons";
import { Button } from "@/components/ui/button";
import type { InstagramSize } from "@/lib/instagram-png";
import { savePhotoInstagramPng } from "@/lib/photo-instagram-png";
import { phoneSharesPng } from "@/lib/share-png";

export function PhotoShare({
  personName,
  drinkName,
  photoUrl,
  entryPath,
}: {
  personName: string;
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
    const share = phoneSharesPng();
    setPending(size);
    setError(null);
    try {
      await savePhotoInstagramPng({ personName, drinkName, photoUrl }, size, share);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : share ? "The picture didn't share." : "The picture didn't save.");
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
      <InstagramImageButtons pending={pending} error={error} onSave={(size) => void save(size)} />
    </div>
  );
}
