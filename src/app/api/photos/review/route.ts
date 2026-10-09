import { jsonError, jsonOk } from "@/lib/api";
import { requestIsReviewer, reviewConfigured } from "@/lib/photo-auth";
import { listPeople } from "@/lib/people";
import { listReviewPhotos } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!reviewConfigured()) {
    return jsonOk({ configured: false, authenticated: false, photos: [], people: [] });
  }
  if (!requestIsReviewer(request)) {
    return jsonOk({ configured: true, authenticated: false, photos: [], people: [] });
  }
  try {
    return jsonOk({
      configured: true,
      authenticated: true,
      photos: listReviewPhotos(),
      people: listPeople(),
    });
  } catch (error) {
    console.error("Failed to list photos for review", safeErrorText(error));
    return jsonError(500, "SERVER", "The review list didn't load. Try again.");
  }
}
