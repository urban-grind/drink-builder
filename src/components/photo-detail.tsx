"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhotoShare } from "@/components/photo-share";
import { PhotoVoteButton } from "@/components/photo-vote-button";
import { useVoter } from "@/components/use-voter";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { firstName } from "@/lib/first-name";
import type { PublicPhoto } from "@/lib/photo-types";
import { formatWhen } from "@/lib/time";
import { cn } from "@/lib/utils";

export function PhotoDetail({ id }: { id: string }) {
  const { voterId, ready } = useVoter();
  const [photo, setPhoto] = useState<PublicPhoto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("This photo didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ voterId });
    requestJson<{ photo: PublicPhoto }>(`/api/photos/${id}?${query.toString()}`, { signal: controller.signal })
      .then((data) => {
        setPhoto(data.photo);
        setStatus("ready");
        document.title = `${data.photo.drinkName} · Urban Grind`;
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
    return () => controller.abort();
  }, [id, ready, voterId, reloadKey]);

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="ug-board grid gap-6 lg:grid-cols-2">
        <p className="sr-only">Loading the photo</p>
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="ug-board rounded-2xl bg-white px-6 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="text-4xl">That photo isn&apos;t here</h1>
        <p className="mt-2">The link may be off.</p>
        <Link href="/" className={cn(buttonVariants(), "mt-4 inline-flex h-11 rounded-full px-4")}>
          Back to the photos
        </Link>
      </div>
    );
  }

  if (status === "error" || !photo) {
    return (
      <div role="alert" className="ug-board rounded-2xl bg-white px-6 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="text-4xl">This photo didn&apos;t load</h1>
        <p className="mt-2">{error}</p>
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

  return (
    <article className="ug-board grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl}
        alt={`${photo.drinkName} by ${firstName(photo.personName)}`}
        className="w-full rounded-2xl bg-white object-contain shadow-[0_16px_40px_rgb(39_75_58/0.06)]"
      />
      <div className="flex flex-col gap-4 rounded-2xl bg-white px-5 py-6 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="text-4xl text-balance">{photo.drinkName}</h1>
        <p>{firstName(photo.personName)}</p>
        {photo.caption ? <p className="text-pretty">{photo.caption}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="ug-display text-3xl leading-none">{photo.voteCount}</span>{" "}
            {photo.voteCount === 1 ? "vote" : "votes"}
          </p>
          <PhotoVoteButton photo={photo} onUpdated={setPhoto} />
        </div>
        <PhotoShare drinkName={photo.drinkName} photoUrl={photo.imageUrl} entryPath={`/photos/${photo.id}`} />
        <time dateTime={photo.createdAt} className="text-sm">
          {formatWhen(photo.createdAt)}
        </time>
        <Link href="/" className="text-sm underline-offset-4 hover:underline">
          Back to the photos
        </Link>
      </div>
    </article>
  );
}
