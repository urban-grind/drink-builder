"use client";

import Link from "next/link";
import { PhotoVoteButton } from "@/components/photo-vote-button";
import type { PublicPhoto } from "@/lib/photo-types";

export function PhotoCard({
  photo,
  rank,
  onUpdated,
}: {
  photo: PublicPhoto;
  rank?: number;
  onUpdated: (photo: PublicPhoto) => void;
}) {
  return (
    <li
      id={rank ? `photo-${photo.id}` : undefined}
      className="flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-2xl bg-white px-4 py-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)]"
    >
      {rank ? (
        <p className="ug-display text-4xl leading-none">
          <span className="sr-only">Rank </span>
          {rank}
        </p>
      ) : null}
      <Link
        href={`/photos/${photo.id}`}
        className="overflow-hidden rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-[#274b3a]/40"
      >
        {/* The board image is already a resized thumbnail from our API. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbUrl} alt="" className="aspect-[4/5] w-full object-cover" />
      </Link>
      <h3 className="text-2xl leading-tight text-balance">
        <Link
          href={`/photos/${photo.id}`}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-[#274b3a]/40"
        >
          {photo.drinkName}
        </Link>
      </h3>
      <p className="text-sm">{photo.personName}</p>
      {photo.caption ? <p className="text-pretty text-sm">{photo.caption}</p> : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-sm">
          <span className="ug-display text-3xl leading-none">{photo.voteCount}</span>{" "}
          {photo.voteCount === 1 ? "vote" : "votes"}
        </p>
        <PhotoVoteButton photo={photo} onUpdated={onUpdated} />
      </div>
    </li>
  );
}
