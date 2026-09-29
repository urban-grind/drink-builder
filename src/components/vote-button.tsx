"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { forgetVote, rememberVote } from "@/lib/local-votes";
import type { PublicDrink } from "@/lib/types";
import { useVoter } from "@/components/use-voter";

export function VoteButton({
  drink,
  onUpdated,
}: {
  drink: PublicDrink;
  onUpdated: (drink: PublicDrink) => void;
}) {
  const { voterId, ready } = useVoter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = `${drink.id}-${useId().replace(/:/g, "")}-vote-error`;

  async function refresh() {
    if (!voterId) return;
    const data = await requestJson<{ drink: PublicDrink }>(
      `/api/drinks/${drink.id}?voterId=${encodeURIComponent(voterId)}`,
    );
    if (data.drink.voted) rememberVote(data.drink.id);
    else forgetVote(data.drink.id);
    onUpdated(data.drink);
  }

  async function onClick() {
    if (!voterId || pending) return;
    setError(null);
    if (drink.voted) return;

    setPending(true);
    try {
      const data = await requestJson<{ drink: PublicDrink }>(`/api/drinks/${drink.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ voterId }),
      });
      rememberVote(drink.id);
      onUpdated(data.drink);
    } catch (caught) {
      if (caught instanceof ApiRequestError && (caught.code === "ALREADY_VOTED" || caught.code === "NOT_VOTED")) {
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

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={drink.voted ? "secondary" : "default"}
        aria-pressed={drink.voted}
        aria-describedby={error ? errorId : undefined}
        disabled={!ready || pending || drink.voted}
        onClick={() => {
          void onClick();
        }}
        className="h-11 rounded-full px-4"
      >
        {pending ? "Saving…" : drink.voted ? "Voted" : "Vote"}
      </Button>
      {error ? (
        <p id={errorId} role="alert" className="max-w-xs text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
