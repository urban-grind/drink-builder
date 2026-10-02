"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { InstagramSize } from "@/lib/instagram-png";
import { phoneSharesPng } from "@/lib/share-png";

function subscribe(onStoreChange: () => void): () => void {
  const query = window.matchMedia("(hover: none) and (pointer: coarse)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function label(size: InstagramSize, pending: InstagramSize | null, share: boolean): string {
  if (pending === size) return share ? "Sharing…" : "Saving…";
  if (share) return size === "story" ? "Share story" : "Share square";
  return size === "story" ? "Instagram story" : "Instagram square";
}

export function InstagramImageButtons({
  pending,
  error,
  onSave,
}: {
  pending: InstagramSize | null;
  error: string | null;
  onSave: (size: InstagramSize) => void;
}) {
  const share = useSyncExternalStore(subscribe, phoneSharesPng, () => false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-4"
          disabled={pending !== null}
          onClick={() => onSave("story")}
        >
          {label("story", pending, share)}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-4"
          disabled={pending !== null}
          onClick={() => onSave("square")}
        >
          {label("square", pending, share)}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
