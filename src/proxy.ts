import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { comingSoonAllowsAsset, comingSoonEnabled, comingSoonHtml } from "@/lib/coming-soon";

export function proxy(request: NextRequest) {
  if (!comingSoonEnabled()) return NextResponse.next();
  if (comingSoonAllowsAsset(request.nextUrl.pathname)) return NextResponse.next();
  return new NextResponse(comingSoonHtml(Date.now()), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
