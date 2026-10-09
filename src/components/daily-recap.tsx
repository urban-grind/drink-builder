"use client";

import { PhotoRace } from "@/components/photo-race";

export function DailyRecap() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div>
        <h1 id="daily-recap" className="text-4xl">
          Daily Recap
        </h1>
        <p className="mt-2 text-pretty text-sm">
          From 7:00 p.m. on October 7 through now, Eastern time. Each night skips from 11:00 p.m. to 5:00 a.m.
        </p>
      </div>
      <PhotoRace />
    </div>
  );
}
