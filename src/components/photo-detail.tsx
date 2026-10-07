"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoEntryView } from "@/components/photo-entry-view";
import { VoteCountedDialog } from "@/components/vote-counted-dialog";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { firstName, photoEntryPath } from "@/lib/first-name";
import type { PublicPhoto } from "@/lib/photo-types";

export function PhotoDetail({
  code,
  onBack,
  onEnter,
  onSwipe,
  onUpdated,
}: {
  code: string;
  onBack?: () => void;
  onEnter?: () => void;
  onSwipe?: () => void;
  onUpdated?: (photo: PublicPhoto) => void;
}) {
  const router = useRouter();
  const { voterId, ready } = useVoter();
  const [photo, setPhoto] = useState<PublicPhoto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("This photo didn't load.");
  const [reloadKey, setReloadKey] = useState(0);
  const [votePending, setVotePending] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [countedOpen, setCountedOpen] = useState(false);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ voterId });
    requestJson<{ photo: PublicPhoto }>(`/api/p/${code}?${query.toString()}`, { signal: controller.signal })
      .then((data) => {
        setPhoto(data.photo);
        setStatus("ready");
        document.title = "Urban Grind Photo Content";
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiRequestError && caught.code === "NOT_FOUND") {
          setStatus("missing");
          return;
        }
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "This photo didn't load.");
      });
    return () => {
      controller.abort();
      document.title = "Urban Grind Photo Content";
    };
  }, [code, ready, voterId, reloadKey]);

  function show(next: PublicPhoto) {
    setPhoto(next);
    onUpdated?.(next);
  }

  async function vote() {
    if (!photo || !voterId || votePending || photo.voted) return;
    setVoteError(null);
    setVotePending(true);
    try {
      const data = await requestJson<{ photo: PublicPhoto }>(`/api/photos/${photo.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ voterId }),
      });
      show(data.photo);
      setCountedOpen(true);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "ALREADY_VOTED") {
        try {
          const data = await requestJson<{ photo: PublicPhoto }>(
            `/api/photos/${photo.id}?voterId=${encodeURIComponent(voterId)}`,
          );
          show(data.photo);
        } catch (refreshError) {
          setVoteError(refreshError instanceof Error ? refreshError.message : "The vote didn't go through.");
        }
      } else {
        setVoteError(caught instanceof Error ? caught.message : "The vote didn't go through.");
      }
    } finally {
      setVotePending(false);
    }
  }

  if (status === "loading" || !ready) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        <BackToPicks onBack={onBack} />
        <p className="sr-only">Loading the photo</p>
        <div className="h-8 w-48 animate-pulse rounded-full bg-white" />
        <div className="aspect-[4/5] animate-pulse rounded-2xl bg-white" />
        <div className="h-16 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="rounded-2xl bg-white px-5 py-8 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <BackToPicks onBack={onBack} />
        <h1 className="font-heading text-3xl uppercase">That photo isn&apos;t here</h1>
        <p className="mt-2 text-sm text-[#274b3a]/75">The link may be off.</p>
      </div>
    );
  }

  if (status === "error" || !photo) {
    return (
      <div role="alert" className="rounded-2xl bg-white px-5 py-8 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <BackToPicks onBack={onBack} />
        <h1 className="font-heading text-3xl uppercase">This photo didn&apos;t load</h1>
        <p className="mt-2 text-sm">{error}</p>
        <Button
          type="button"
          onClick={() => {
            setStatus("loading");
            setReloadKey((value) => value + 1);
          }}
          className="mt-4 h-11 rounded-full px-4"
        >
          Try again
        </Button>
      </div>
    );
  }

  const enter = onEnter ?? (() => router.push("/?upload=1"));
  const swipe = onSwipe ?? (() => router.push("/#swipe"));

  return (
    <>
      <PhotoEntryView
        mode="visitor"
        personName={photo.personName}
        drinkName={photo.drinkName}
        photoUrl={photo.imageUrl}
        voteCount={photo.voteCount}
        createdAt={photo.createdAt}
        entryPath={photoEntryPath(photo.code)}
        voted={photo.voted}
        votePending={votePending}
        voteError={voteError}
        onBack={onBack}
        onVote={() => void vote()}
        onEnter={enter}
      />
      <VoteCountedDialog
        open={countedOpen}
        name={firstName(photo.personName)}
        onClose={() => setCountedOpen(false)}
        onSwipe={() => {
          setCountedOpen(false);
          swipe();
        }}
        onEnter={() => {
          setCountedOpen(false);
          enter();
        }}
      />
    </>
  );
}

function BackToPicks({ onBack }: { onBack?: () => void }) {
  const className = "mb-3 inline-flex items-center text-sm font-semibold text-[#274b3a]";
  if (onBack) {
    return (
      <button type="button" onClick={onBack} className={className}>
        ← Leaderboard
      </button>
    );
  }
  return (
    <Link href="/?picks=1" className={className}>
      ← Leaderboard
    </Link>
  );
}
