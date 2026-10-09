"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const LINES = ["Grinding the beans", "Pulling the shot", "Making the drink"] as const;
const PAUSE_MS = 750;

let lineIndex = 0;
let lastRequest = 0;

/** Shows the next coffee line. A second call in the same moment does not skip ahead. */
export function requestPour(): void {
  const now = Date.now();
  if (now - lastRequest < 50) return;
  lastRequest = now;
  window.dispatchEvent(new Event("ug-pour"));
}

export function PourPause() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  const timer = useRef(0);
  const [line, setLine] = useState<string | null>(null);
  const [top, setTop] = useState(0);

  useEffect(() => {
    function show() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const header = document.querySelector("header");
      setTop(header ? Math.max(0, header.getBoundingClientRect().bottom) : 0);
      setLine(LINES[lineIndex % LINES.length]);
      lineIndex += 1;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLine(null), PAUSE_MS);
    }
    window.addEventListener("ug-pour", show);
    return () => {
      window.removeEventListener("ug-pour", show);
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    requestPour();
  }, [pathname]);

  if (!line) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[#f3f2ef] text-[#274b3a]" style={{ top }}>
      <style>{`
        @keyframes drink-pour {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes drink-steam {
          0% { transform: translateY(3px); opacity: 0; }
          35% { opacity: 0.85; }
          100% { transform: translateY(-14px); opacity: 0; }
        }
        .drink-pour { animation: drink-pour 400ms ease both; }
        .drink-steam { transform-box: fill-box; animation: drink-steam 700ms ease infinite; }
        @media (prefers-reduced-motion: reduce) {
          .drink-pour, .drink-steam { animation: none; }
        }
      `}</style>
      <span className="drink-pour grid h-20 w-20 place-items-center rounded-full bg-[#e7f0ea]" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M6 8h10v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8z" />
          <path d="M16 9h2.2a2.2 2.2 0 0 1 0 4.4H16" strokeLinecap="round" />
          <path className="drink-steam" d="M8 4.5c.4.8.4 1.4 0 2.2M12 4.5c.4.8.4 1.4 0 2.2" strokeLinecap="round" />
        </svg>
      </span>
      <p className="font-heading text-3xl" role="status">{line}</p>
    </div>
  );
}
