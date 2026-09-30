import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import {
  passwordsMatch,
  REVIEW_COOKIE,
  reviewCookieOptions,
  reviewPassword,
  reviewSessionToken,
  sameOrigin,
} from "@/lib/photo-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "FORBIDDEN", "Open the review page on this site.");
  const password = reviewPassword();
  if (!password) return jsonError(503, "REVIEW_UNAVAILABLE", "Photo review is not set up.");

  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const given =
    body.value && typeof body.value === "object" && "password" in body.value
      ? (body.value as { password?: unknown }).password
      : undefined;
  if (typeof given !== "string" || !passwordsMatch(given, password)) {
    return jsonError(401, "UNAUTHORIZED", "That password is not the review password.");
  }

  const response = jsonOk({ ok: true });
  response.cookies.set(REVIEW_COOKIE, reviewSessionToken(password), reviewCookieOptions());
  return response;
}
