import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import { photosConfigured } from "@/lib/r2";
import { listPhotoBoard, submitPhoto } from "@/lib/photos";
import { parseVoterId } from "@/lib/validation";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const voterParam = url.searchParams.get("voterId");
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
    return jsonOk({ ...listPhotoBoard(voterId), uploadsEnabled: photosConfigured() });
  } catch (error) {
    console.error("Failed to list photos", safeErrorText(error));
    return jsonError(500, "SERVER", "The photo board didn't load. Try again.");
  }
}

export async function POST(request: Request) {
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;

  const record = body.value;
  const uploadId =
    record && typeof record === "object" && "uploadId" in record ? (record as { uploadId?: unknown }).uploadId : undefined;
  if (typeof uploadId !== "string" || !isUuid(uploadId)) {
    return jsonError(400, "VALIDATION", "That upload wasn't found. Choose the photo again.", {
      photo: "Choose a photo and try again.",
    });
  }

  try {
    const result = await submitPhoto({
      uploadId,
      personName: valueOf(record, "personName"),
      email: valueOf(record, "email"),
      drinkName: valueOf(record, "drinkName"),
      caption: valueOf(record, "caption"),
    });
    if (!result.ok) {
      const status = result.code === "EMAIL_IN_USE" ? 409 : result.code === "PHOTOS_UNAVAILABLE" ? 503 : 400;
      return jsonError(status, result.code, result.message, result.fields);
    }
    return jsonOk({ id: result.id, status: result.status }, 201);
  } catch (error) {
    console.error("Failed to save photo entry", safeErrorText(error));
    return jsonError(500, "SERVER", "The photo didn't go through. Try again.");
  }
}

function valueOf(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  return (record as Record<string, unknown>)[key];
}
