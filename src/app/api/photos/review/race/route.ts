import { jsonError, jsonOk } from "@/lib/api";
import { requestIsReviewer, reviewConfigured } from "@/lib/photo-auth";
import { loadVoteRace } from "@/lib/photo-race-load";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!reviewConfigured()) return jsonError(503, "NOT_CONFIGURED", "Photo review is not set up.");
  if (!requestIsReviewer(request)) return jsonError(401, "UNAUTHORIZED", "Sign in to review photos.");
  try {
    return jsonOk({ race: loadVoteRace() });
  } catch (error) {
    console.error("Failed to load the vote race", safeErrorText(error));
    return jsonError(500, "SERVER", "The race didn't load. Try again.");
  }
}
