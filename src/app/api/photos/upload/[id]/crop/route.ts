import { jsonError, jsonOk } from "@/lib/api";
import { parsePhotoCrop } from "@/lib/photo-crop";
import { readPhotoJson } from "@/lib/photo-http";
import { saveUploadCrop } from "@/lib/photo-prepare";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "UPLOAD_NOT_FOUND", "That upload wasn't found. Choose the photo again.");

  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const crop = parsePhotoCrop(body.value && typeof body.value === "object" ? (body.value as { crop?: unknown }).crop : null);
  if (!crop) {
    return jsonError(400, "VALIDATION", "Frame the photo and try again.", {
      photo: "Frame the photo and try again.",
    });
  }

  try {
    const result = await saveUploadCrop(id, crop);
    if (!result.ok) {
      const status = result.code === "PHOTOS_UNAVAILABLE" ? 503 : result.code === "UPLOAD_REPLACED" ? 409 : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ ready: true });
  } catch (error) {
    console.error("Failed to crop a photo", safeErrorText(error));
    return jsonError(500, "SERVER", "The photo didn't go through. Try again.");
  }
}
