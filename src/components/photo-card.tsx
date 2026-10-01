"use client";

import Link from "next/link";
import { PhotoVoteButton } from "@/components/photo-vote-button";
import type { PublicPhoto } from "@/lib/photo-types";

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export function PhotoCard({
  photo,
  onUpdated,
}: {
  photo: PublicPhoto;
  rank?: number;
  onUpdated: (photo: PublicPhoto) => void;
}) {
  const name = photo.personName.trim();

  return (
    <li
      id={`photo-${photo.id}`}
      className="flex min-w-0 scroll-mt-28 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#274b3a]/10"
    >
      <Link
        href={photo.code ? `/p/${photo.code}` : "/"}
        className="block outline-none focus-visible:ring-3 focus-visible:ring-[#274b3a]/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbUrl} alt={photo.drinkName} className="aspect-[4/5] w-full object-cover" />
      </Link>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div>
          <p className="font-heading text-3xl leading-none">{name}</p>
          <time dateTime={photo.createdAt} className="mt-1 block text-lg font-bold">
            {shortDate(photo.createdAt)}
          </time>
          <h3 className="mt-2 text-sm leading-snug text-[#274b3a]/75">{photo.drinkName}</h3>
          {photo.caption ? <p className="mt-1 text-sm text-[#274b3a]/60">{photo.caption}</p> : null}
        </div>
        <PhotoVoteButton photo={photo} onUpdated={onUpdated} appearance="count" />
      </div>
    </li>
  );
}
