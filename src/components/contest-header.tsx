import type { ReactNode } from "react";
import Link from "next/link";
import { CafeLink } from "@/components/cafe-link";

const enterClass =
  "inline-flex items-center rounded-full border border-[#274b3a] bg-transparent px-3.5 py-2 text-sm font-semibold text-[#274b3a]";

export function ContestHeader({ logo, action }: { logo: ReactNode; action: ReactNode }) {
  return (
    <header className="sticky top-0 z-[80] shrink-0 border-b border-[#274b3a]/12 bg-[#f3f2ef]/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[26rem] items-center justify-between gap-4 px-5 pt-4 pb-3.5 md:max-w-7xl md:px-10 md:pt-6">
        <div className="flex min-w-0 flex-col items-start gap-1.5 md:flex-row md:items-center md:gap-4">
          {logo}
          <CafeLink />
        </div>
        {action}
      </div>
    </header>
  );
}

export function EnterLink({ href = "/?upload=1" }: { href?: string }) {
  return (
    <Link href={href} className={enterClass}>
      + Enter
    </Link>
  );
}

export function EnterButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={enterClass}>
      + Enter
    </button>
  );
}
