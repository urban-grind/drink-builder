import Link from "next/link";
import { OpenUploadButton } from "@/components/upload-dialog";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#274b3a]/10 bg-[#f3f2ef]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 lg:px-8">
        <Link href="/" className="font-heading text-[1.7rem] leading-none tracking-tight text-[#274b3a] sm:text-3xl">
          Urban Grind
        </Link>
        <OpenUploadButton className="inline-flex items-center rounded-full bg-[#274b3a] px-4 py-2.5 text-xs font-bold tracking-[0.12em] text-[#f3f2ef] uppercase shadow-md transition-colors hover:bg-[#1e3b2e] sm:px-6 sm:py-3 sm:text-sm">
          Upload a photo
        </OpenUploadButton>
      </div>
    </header>
  );
}
