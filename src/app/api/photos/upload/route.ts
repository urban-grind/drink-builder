import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import { createUpload } from "@/lib/photos";
import { parsePhotoUploadRequest } from "@/lib/photo-validation";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;

  const parsed = parsePhotoUploadRequest(body.value);
  if (!parsed.ok) return jsonError(400, "VALIDATION", parsed.message);

  try {
    const result = await createUpload(parsed);
    if (!result.ok) return jsonError(503, result.code, result.message);
    return jsonOk(
      {
        uploadId: result.uploadId,
        uploadUrl: result.uploadUrl,
        contentType: result.contentType,
      },
      201,
    );
  } catch (error) {
    console.error("Failed to prepare photo upload", safeErrorText(error));
    return jsonError(500, "SERVER", "The photo upload didn't start. Try again.");
  }
}
