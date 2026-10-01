"use client";

import { useId, useState } from "react";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";

export function PhotoVoteButton({
  photo,
  onUpdated,
  appearance = "button",
}: {
  photo: PublicPhoto;
  onUpdated: (photo: PublicPhoto) => void;
  appearance?: "button" | "count";
}) {
  const { voterId, ready } = useVoter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = `${photo.id}-${useId().replace(/:/g, "")}-vote-error`;

  async function refresh() {
    if (!voterId) return;
    const data = await requestJson<{ photo: PublicPhoto }>(
      `/api/photos/${photo.id}?voterId=${encodeURIComponent(voterId)}`,
    );
    onUpdated(data.photo);
  }

  async function onClick() {
    if (!voterId || pending || photo.voted) return;
    setError(null);
    setPending(true);
    try {
      const data = await requestJson<{ photo: PublicPhoto }>(`/api/photos/${photo.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ voterId }),
      });
      onUpdated(data.photo);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "ALREADY_VOTED") {
        try {
          await refresh();
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : "The vote didn't go through.");
        }
      } else {
        setError(caught instanceof Error ? caught.message : "The vote didn't go through.");
      }
    } finally {
      setPending(false);
    }
  }

  const countLabel = `${photo.voted ? "Voted" : "Vote"} · ${photo.voteCount}`;
  const label = pending ? "Saving…" : appearance === "count" ? countLabel : photo.voted ? "Voted" : "Vote";

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={photo.voted ? "secondary" : "default"}
        aria-pressed={photo.voted}
        aria-describedby={error ? errorId : undefined}
        disabled={!ready || pending || photo.voted}
        onClick={() => {
          void onClick();
        }}
        className="h-11 rounded-full px-4"
      >
        {label}
      </Button>
      {error ? (
        <p id={errorId} role="alert" className="max-w-xs text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
