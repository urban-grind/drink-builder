import { jsonError, jsonOk } from "@/lib/api";
import { listPhotoLeaderboard } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ photos: listPhotoLeaderboard() });
  } catch (error) {
    console.error("Failed to load the leaderboard", safeErrorText(error));
    return jsonError(500, "SERVER", "The leaderboard didn't load. Try again.");
  }
}
