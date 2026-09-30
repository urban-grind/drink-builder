"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMyDrinkId } from "@/components/use-my-drink";
import { cn } from "@/lib/utils";

function menuItemClass(active: boolean) {
  return cn(
    "rounded-full px-3 py-2 text-[0.7rem] font-bold tracking-[0.14em] text-[#f3f2ef] uppercase outline-none focus-visible:ring-3 focus-visible:ring-white/70",
    active ? "bg-white text-[#274b3a]" : "hover:bg-white/10",
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const myDrinkId = useMyDrinkId();
  const buildActive = pathname === "/";
  const boardActive =
    pathname === "/drinks" || (pathname.startsWith("/drinks/") && !pathname.endsWith("/congrats"));
  const photosActive = pathname === "/photos" || pathname.startsWith("/photos/");
  const myDrinkActive =
    pathname === "/my-drink" || (myDrinkId !== null && pathname === `/drinks/${myDrinkId}/congrats`);

  return (
    <header className="sticky top-0 z-20 bg-[#274b3a] text-[#f3f2ef]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-heading text-[1.65rem] leading-none tracking-tight text-[#f3f2ef] sm:text-3xl">
          Drink Builder
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <Link href="/" aria-current={buildActive ? "page" : undefined} className={menuItemClass(buildActive)}>
            Build
          </Link>
          <button
            type="button"
            aria-current={myDrinkActive ? "page" : undefined}
            onClick={() => router.push(myDrinkId ? `/drinks/${myDrinkId}/congrats` : "/my-drink")}
            className={menuItemClass(myDrinkActive)}
          >
            My drink
          </button>
          <Link
            href="/drinks"
            aria-current={boardActive ? "page" : undefined}
            className={menuItemClass(boardActive)}
          >
            The board
          </Link>
          <Link
            href="/photos"
            aria-current={photosActive ? "page" : undefined}
            className={menuItemClass(photosActive)}
          >
            Photos
          </Link>
        </nav>
      </div>
    </header>
  );
}
