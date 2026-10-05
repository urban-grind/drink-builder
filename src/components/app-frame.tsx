"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const swipe = pathname === "/" || pathname === "/terms" || pathname.startsWith("/p/");

  if (swipe) {
    return (
      <main id="content" tabIndex={-1} className="ug-swipe flex min-h-dvh flex-1 flex-col bg-[#f3f2ef] text-[#274b3a] outline-none">
        {children}
      </main>
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="bg-[#274b3a] text-[#f3f2ef]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-10 sm:flex-row sm:items-end sm:justify-between lg:px-8">
          <p className="font-heading text-2xl leading-none sm:text-3xl">Urban Grind Coffee Co.</p>
          <p className="text-sm tracking-wide">Barrie</p>
        </div>
      </footer>
    </>
  );
}
