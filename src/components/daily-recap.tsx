"use client";

import { PhotoRace } from "@/components/photo-race";

export function DailyRecap() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div>
        <h1 id="daily-recap" className="text-4xl">
          Daily Recap
        </h1>
        <p className="mt-2 text-pretty text-sm">From the contest open through now, Eastern time.</p>
      </div>
      <PhotoRace />
    </div>
  );
}
