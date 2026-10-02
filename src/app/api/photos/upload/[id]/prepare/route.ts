import { jsonError, jsonOk } from "@/lib/api";
import { prepareUpload } from "@/lib/photo-prepare";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "UPLOAD_NOT_FOUND", "That upload wasn't found. Choose the photo again.");

  try {
    const result = await prepareUpload(id);
    if (!result.ok) {
      const status =
        result.code === "PHOTOS_UNAVAILABLE" ? 503 : result.code === "UPLOAD_REPLACED" ? 409 : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ ready: true });
  } catch (error) {
    console.error("Failed to prepare a photo", safeErrorText(error));
    return jsonError(500, "SERVER", "The photo didn't go through. Try again.");
  }
}
