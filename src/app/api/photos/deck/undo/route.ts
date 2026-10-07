import { jsonError, jsonOk } from "@/lib/api";
import { drawProgress } from "@/lib/draw-entry";
import { readPhotoJson } from "@/lib/photo-http";
import { undoDeckSwipe } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid, parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const record = body.value as { voterId?: unknown; photoId?: unknown };
  const voter = parseVoterId(record.voterId);
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }
  if (typeof record.photoId !== "string" || !isUuid(record.photoId)) {
    return jsonError(404, "NOT_FOUND", "That photo isn't here.");
  }
  try {
    const result = undoDeckSwipe(voter.voterId, record.photoId);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 409;
      const message = result.code === "NOT_FOUND" ? "That photo isn't here." : "Only the last swipe can be undone.";
      return jsonError(status, result.code, message);
    }
    return jsonOk({ action: result.action, photo: result.photo, ...drawProgress(voter.voterId) });
  } catch (error) {
    console.error("Failed to undo a swipe", safeErrorText(error));
    return jsonError(500, "SERVER", "That undo didn't go through. Try again.");
  }
}
