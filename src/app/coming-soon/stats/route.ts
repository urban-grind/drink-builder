import { NextResponse } from "next/server";
import { comingSoonStats } from "@/lib/coming-soon-stats";
import {
  passwordsMatch,
  REVIEW_COOKIE,
  reviewCookieOptions,
  reviewPassword,
  reviewSessionToken,
  requestIsReviewer,
  sameOrigin,
} from "@/lib/photo-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};

function page(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Coming soon numbers</title>
<style>
  body { margin: 0; background: #f7f4ec; color: #274b3a; font-family: Georgia, serif; }
  main { max-width: 24rem; margin: 0 auto; padding: 2.5rem 1.25rem 3rem; }
  h1 { font-size: 1.75rem; line-height: 1.1; margin: 0 0 1.5rem; }
  p { line-height: 1.45; }
  form { display: grid; gap: 0.75rem; }
  label { font-size: 0.95rem; }
  input { height: 3rem; border: 1px solid #d5d1c9; border-radius: 999px; padding: 0 1rem; font-size: 16px; color: #274b3a; }
  button { height: 3rem; border: 0; border-radius: 999px; background: #274b3a; color: #f3f2ef; font-size: 1rem; font-weight: 650; }
  .error { color: #9b2c2c; }
  dl { display: grid; gap: 1rem; margin: 0; }
  div { background: white; border-radius: 1.25rem; padding: 1rem 1.15rem; }
  dt { font-size: 0.95rem; }
  dd { margin: 0.2rem 0 0; font-size: 2.25rem; font-variant-numeric: tabular-nums; }
  .note { margin-top: 1.25rem; font-size: 0.95rem; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function loginHtml(error = ""): string {
  return page(`<h1>Coming soon numbers</h1>
${error ? `<p class="error" role="alert">${error}</p>` : ""}
<form method="post">
<label for="password">Review password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Show the numbers</button>
</form>`);
}

function statsHtml(): string {
  const stats = comingSoonStats();
  return page(`<h1>Coming soon numbers</h1>
<dl>
<div><dt>Unique visitors</dt><dd>${stats.visitors}</dd></div>
<div><dt>Visits</dt><dd>${stats.visits}</dd></div>
<div><dt>Story downloads</dt><dd>${stats.storyClicks}</dd></div>
</dl>
<p class="note">A refresh counts as another visit. Each browser is one unique visitor. Story downloads count each tap on Download the story.</p>`);
}

export async function GET(request: Request) {
  const html = requestIsReviewer(request) ? statsHtml() : loginHtml();
  return new NextResponse(html, { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return new NextResponse(loginHtml("Open this page on the site."), { status: 403, headers });
  }
  const expected = reviewPassword();
  if (!expected) {
    return new NextResponse(loginHtml("The review password is not set up."), { status: 503, headers });
  }
  const form = await request.formData();
  const given = form.get("password");
  if (typeof given !== "string" || !passwordsMatch(given, expected)) {
    return new NextResponse(loginHtml("That password is not the review password."), { status: 401, headers });
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const back = host ? `${proto}://${host}/coming-soon/stats` : new URL("/coming-soon/stats", request.url);
  const response = NextResponse.redirect(back, 303);
  response.cookies.set(REVIEW_COOKIE, reviewSessionToken(expected), reviewCookieOptions());
  return response;
}
