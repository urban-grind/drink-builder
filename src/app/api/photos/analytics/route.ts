import { jsonError, jsonOk } from "@/lib/api";
import { siteUsage } from "@/lib/contest-stats";
import { requestIsReviewer, reviewConfigured } from "@/lib/photo-auth";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!reviewConfigured()) {
    return jsonOk({ configured: false, authenticated: false, usage: null });
  }
  if (!requestIsReviewer(request)) {
    return jsonOk({ configured: true, authenticated: false, usage: null });
  }
  try {
    return jsonOk({ configured: true, authenticated: true, usage: siteUsage() });
  } catch (error) {
    console.error("Failed to load site activity", safeErrorText(error));
    return jsonError(500, "SERVER", "Site activity didn't load. Try again.");
  }
}
