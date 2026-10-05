"use client";

import { useEffect, useState } from "react";
import { entryCountdownLabel, entryTimeLeft, type EntryTimeLeft } from "@/lib/entry-countdown";

const units = [
  ["days", "day"],
  ["hours", "hour"],
  ["minutes", "minute"],
  ["seconds", "second"],
] as const;

export function EntryCountdown({ className = "" }: { className?: string }) {
  const [left, setLeft] = useState<EntryTimeLeft | null>(null);

  useEffect(() => {
    const tick = () => setLeft(entryTimeLeft(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!left) return <div className={`h-[4.75rem] ${className}`} aria-hidden="true" />;

  if (left.closed) {
    return <p className={`text-sm font-semibold text-[#274b3a] ${className}`}>Entries are closed</p>;
  }

  return (
    <div className={className} role="timer" aria-label={entryCountdownLabel(left)}>
      <p className="text-[11px] font-bold tracking-[0.14em] text-[#274b3a]/70 uppercase">Accepting entries for</p>
      <div className="mt-2 flex gap-2">
        {units.map(([key, word]) => (
          <div
            key={key}
            className="flex min-w-[3.6rem] flex-col items-center rounded-2xl bg-white px-2 py-2 shadow-[0_8px_20px_rgb(39_75_58/0.06)]"
          >
            <span className="font-heading text-2xl leading-none tabular-nums">{left[key]}</span>
            <span className="mt-1 text-[10px] font-semibold tracking-wide text-[#274b3a]/55 uppercase">
              {left[key] === 1 ? word : key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
