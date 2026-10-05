import { connection } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { LEADERBOARD_PAGE_SIZE, listPhotoLeaderboard } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pageNumber(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  try {
    return jsonOk(
      listPhotoLeaderboard({
        offset: pageNumber(url.searchParams.get("offset"), 0, 10_000),
        limit: pageNumber(url.searchParams.get("limit"), LEADERBOARD_PAGE_SIZE, 24),
      }),
    );
  } catch (error) {
    console.error("Failed to load the leaderboard", safeErrorText(error));
    return jsonError(500, "SERVER", "The leaderboard didn't load. Try again.");
  }
}
