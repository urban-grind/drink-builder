import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#274b3a]/10 bg-[#f3f2ef]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 lg:px-8">
        <Link href="/" className="font-heading text-[1.7rem] leading-none tracking-tight text-[#274b3a] sm:text-3xl">
          Urban Grind
        </Link>
        <Link
          href="/photos/enter"
          className="inline-flex items-center rounded-full bg-[#274b3a] px-5 py-2.5 text-sm font-bold text-[#f3f2ef] shadow-md transition-colors hover:bg-[#1e3b2e] sm:px-7 sm:py-3"
        >
          Add your photo
        </Link>
      </div>
    </header>
  );
}
