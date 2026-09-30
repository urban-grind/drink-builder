"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function menuItemClass(active: boolean) {
  return cn(
    "rounded-full px-3 py-2 text-[0.7rem] font-bold tracking-[0.14em] text-[#f3f2ef] uppercase outline-none focus-visible:ring-3 focus-visible:ring-white/70",
    active ? "bg-white text-[#274b3a]" : "hover:bg-white/10",
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const photosActive = pathname === "/" || pathname === "/photos" || pathname.startsWith("/photos/");

  return (
    <header className="sticky top-0 z-20 bg-[#274b3a] text-[#f3f2ef]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-heading text-[1.65rem] leading-none tracking-tight text-[#f3f2ef] sm:text-3xl">
          Urban Grind
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <Link href="/" aria-current={photosActive ? "page" : undefined} className={menuItemClass(photosActive)}>
            Photos
          </Link>
        </nav>
      </div>
    </header>
  );
}
