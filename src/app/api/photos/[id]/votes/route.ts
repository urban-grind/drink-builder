import { jsonError, jsonOk } from "@/lib/api";
import { requestIsReviewer, reviewConfigured } from "@/lib/photo-auth";
import { auditPhotoVotes } from "@/lib/photo-vote-audit";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!reviewConfigured()) return jsonError(503, "REVIEW_UNAVAILABLE", "Photo review is not set up.");
  if (!requestIsReviewer(request)) return jsonError(401, "UNAUTHORIZED", "Enter the review password.");

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "That photo isn't in the review list.");

  try {
    const audit = auditPhotoVotes(id);
    if (!audit) return jsonError(404, "NOT_FOUND", "That photo isn't in the review list.");
    return jsonOk({ audit });
  } catch (error) {
    console.error("Failed to read photo votes", safeErrorText(error));
    return jsonError(500, "SERVER", "Those votes didn't load. Try again.");
  }
}
