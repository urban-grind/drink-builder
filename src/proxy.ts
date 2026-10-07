import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requestIsReviewer } from "@/lib/photo-auth";
import { comingSoonAllowsAsset, comingSoonAllowsReview, comingSoonEnabled, comingSoonHtml } from "@/lib/coming-soon";

export function proxy(request: NextRequest) {
  if (!comingSoonEnabled()) return NextResponse.next();
  const pathname = request.nextUrl.pathname;
  if (comingSoonAllowsAsset(pathname)) return NextResponse.next();
  if (comingSoonAllowsReview(pathname, requestIsReviewer(request))) return NextResponse.next();
  return new NextResponse(comingSoonHtml(Date.now()), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
