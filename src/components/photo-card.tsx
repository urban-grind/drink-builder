"use client";

import Link from "next/link";
import { PhotoVoteButton } from "@/components/photo-vote-button";
import type { PublicPhoto } from "@/lib/photo-types";

export function PhotoCard({
  photo,
  onUpdated,
}: {
  photo: PublicPhoto;
  rank?: number;
  onUpdated: (photo: PublicPhoto) => void;
}) {
  return (
    <li
      id={`photo-${photo.id}`}
      className="group flex min-w-0 scroll-mt-28 flex-col rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#274b3a]/10 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <Link
        href={`/photos/${photo.id}`}
        className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-[#274b3a]/40"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          {/* The board image is already a resized thumbnail from our API. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <h3 className="mt-3 px-1 text-xl leading-tight text-balance">{photo.drinkName}</h3>
        <p className="mt-1 px-1 text-sm text-[#274b3a]/60">{photo.personName}</p>
      </Link>
      {photo.caption ? <p className="mt-2 line-clamp-2 px-1 text-sm text-[#3f5d4e]">{photo.caption}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3 px-1 pb-1">
        <p className="text-sm">
          <span className="font-heading text-3xl leading-none">{photo.voteCount}</span>{" "}
          {photo.voteCount === 1 ? "vote" : "votes"}
        </p>
        <PhotoVoteButton photo={photo} onUpdated={onUpdated} />
      </div>
    </li>
  );
}
