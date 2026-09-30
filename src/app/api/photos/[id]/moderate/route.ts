import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import { requestIsReviewer, reviewConfigured, sameOrigin } from "@/lib/photo-auth";
import { moderatePhoto } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return jsonError(403, "FORBIDDEN", "Open the review page on this site.");
  if (!reviewConfigured()) return jsonError(503, "REVIEW_UNAVAILABLE", "Photo review is not set up.");
  if (!requestIsReviewer(request)) return jsonError(401, "UNAUTHORIZED", "Enter the review password.");

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "That photo isn't in the review list.");

  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const action =
    body.value && typeof body.value === "object" && "action" in body.value
      ? (body.value as { action?: unknown }).action
      : undefined;
  if (action !== "approve" && action !== "reject" && action !== "remove") {
    return jsonError(400, "VALIDATION", "Choose approve, reject, or take down.");
  }

  try {
    const result = moderatePhoto(id, action);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 409;
      const message =
        result.code === "NOT_FOUND"
          ? "That photo isn't in the review list."
          : "That action doesn't fit this photo anymore. Refresh the list.";
      return jsonError(status, result.code, message);
    }
    return jsonOk({ photo: result.photo });
  } catch (error) {
    console.error("Failed to review photo", safeErrorText(error));
    return jsonError(500, "SERVER", "The review didn't save. Try again.");
  }
}
