import { jsonError, jsonOk } from "@/lib/api";
import { contestReport, emptyContestReport } from "@/lib/contest-stats";
import { requestIsReviewer, reviewConfigured } from "@/lib/photo-auth";
import { listPeople } from "@/lib/people";
import { listReviewPhotos } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!reviewConfigured()) {
    return jsonOk({ configured: false, authenticated: false, photos: [], people: [], activity: emptyContestReport() });
  }
  if (!requestIsReviewer(request)) {
    return jsonOk({ configured: true, authenticated: false, photos: [], people: [], activity: emptyContestReport() });
  }
  try {
    return jsonOk({
      configured: true,
      authenticated: true,
      photos: listReviewPhotos(),
      people: listPeople(),
      activity: contestReport(),
    });
  } catch (error) {
    console.error("Failed to list photos for review", safeErrorText(error));
    return jsonError(500, "SERVER", "The review list didn't load. Try again.");
  }
}
