"use client";

import { useState } from "react";
import { InstagramImageButtons } from "@/components/instagram-image-buttons";
import { saveInstagramPng, type InstagramSize } from "@/lib/instagram-png";
import { phoneSharesPng } from "@/lib/share-png";
import type { PublicDrink } from "@/lib/types";

export function InstagramDownloads({ drink }: { drink: PublicDrink }) {
  const [pending, setPending] = useState<InstagramSize | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(size: InstagramSize) {
    if (pending) return;
    const share = phoneSharesPng();
    setPending(size);
    setError(null);
    try {
      await saveInstagramPng(drink, size, share);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : share ? "The picture didn't share." : "The picture didn't save.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <InstagramImageButtons pending={pending} error={error} onSave={(size) => void save(size)} />
    </div>
  );
}
