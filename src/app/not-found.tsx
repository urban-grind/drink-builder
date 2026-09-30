import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="rounded-2xl bg-white px-6 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
      <h1 className="font-heading text-4xl">That page isn&apos;t here</h1>
      <p className="mt-2 text-muted-foreground">Try the photos.</p>
      <Link href="/" className={cn(buttonVariants(), "mt-4 h-11 rounded-full px-4")}>
        Back to the photos
      </Link>
    </div>
  );
}
