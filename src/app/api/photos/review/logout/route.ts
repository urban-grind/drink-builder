import { jsonError, jsonOk } from "@/lib/api";
import { REVIEW_COOKIE, reviewCookieOptions, sameOrigin } from "@/lib/photo-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "FORBIDDEN", "Open the review page on this site.");
  const response = jsonOk({ ok: true });
  response.cookies.set(REVIEW_COOKIE, "", reviewCookieOptions(0));
  return response;
}
