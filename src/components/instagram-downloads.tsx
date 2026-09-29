"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadInstagramPng, type InstagramSize } from "@/lib/instagram-png";
import type { PublicDrink } from "@/lib/types";

export function InstagramDownloads({ drink }: { drink: PublicDrink }) {
  const [pending, setPending] = useState<InstagramSize | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(size: InstagramSize) {
    if (pending) return;
    setPending(size);
    setError(null);
    try {
      await downloadInstagramPng(drink, size);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The picture didn't save.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
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
