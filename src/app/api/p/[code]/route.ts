import { jsonError, jsonOk } from "@/lib/api";
import { isPhotoCode } from "@/lib/photo-code";
import { getPublicPhotoByCode } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";
import { parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!isPhotoCode(code)) return jsonError(404, "NOT_FOUND", "That photo isn't here.");

  const voterParam = new URL(request.url).searchParams.get("voterId");
  let voterId: string | null = null;
  if (voterParam !== null) {
    const voter = parseVoterId(voterParam);
    if (!voter.ok) {
      return jsonError(400, "VALIDATION", "That voter id is not valid.", {
        voterId: "Send the voter id stored in this browser.",
      });
    }
    voterId = voter.voterId;
  }

  try {
    const photo = getPublicPhotoByCode(code, voterId);
    if (!photo) return jsonError(404, "NOT_FOUND", "That photo isn't here.");
    return jsonOk({ photo });
  } catch (error) {
    console.error("Failed to load photo", safeErrorText(error));
    return jsonError(500, "SERVER", "This photo didn't load. Try again.");
  }
}
