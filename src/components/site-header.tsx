"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CafeLink } from "@/components/cafe-link";
import { ContestHeader, EnterLink } from "@/components/contest-header";
import { OpenUploadButton } from "@/components/upload-dialog";

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/top-drinks") {
    return (
      <ContestHeader
        logo={
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/urban-grind-logo.png" alt="Urban Grind Coffee Co." className="h-11 w-auto" />
          </Link>
        }
        action={<EnterLink />}
      />
    );
  }

  const review = pathname === "/photos/review" || pathname === "/photos/analytics";

  return (
    <header className="sticky top-0 z-[80] border-b border-[#274b3a]/10 bg-[#f3f2ef]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 lg:px-8">
        <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/urban-grind-logo.png" alt="Urban Grind Coffee Co." className="h-11 w-auto" />
          </Link>
          <CafeLink />
        </div>
        {review ? null : (
          <OpenUploadButton className="inline-flex items-center rounded-full bg-[#274b3a] px-4 py-2.5 text-xs font-bold tracking-[0.12em] text-[#f3f2ef] uppercase shadow-md transition-colors hover:bg-[#1e3b2e] sm:px-6 sm:py-3 sm:text-sm">
            Upload a photo
          </OpenUploadButton>
        )}
      </div>
    </header>
  );
}
