import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REVIEW_COOKIE = "ug_photo_review";
const SESSION_LABEL = "urban-grind-photo-review-v1";
export const REVIEW_MAX_AGE_SECONDS = 60 * 60 * 12;

export function reviewConfigured(): boolean {
  return Boolean(process.env.PHOTO_REVIEW_PASSWORD);
}

export function reviewPassword(): string | null {
  const password = process.env.PHOTO_REVIEW_PASSWORD;
  if (!password) return null;
  return password;
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function reviewSessionToken(password: string): string {
  return createHmac("sha256", password).update(SESSION_LABEL).digest("base64url");
}

export function reviewTokenMatches(value: string | undefined): boolean {
  const password = reviewPassword();
  if (!password || !value) return false;
  const expected = reviewSessionToken(password);
  const left = Buffer.from(expected);
  const right = Buffer.from(value);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function requestIsReviewer(request: Request): boolean {
  return reviewTokenMatches(readCookie(request, REVIEW_COOKIE));
}

/** State-changing review calls must come from this site. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin) {
    if (!host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
}

export function reviewCookieOptions(maxAge = REVIEW_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
