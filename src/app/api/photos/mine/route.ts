import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import { findOwnedPhotosByContact, listOwnedPhotos } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid, parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function voterFrom(value: unknown) {
  const voterId =
    value && typeof value === "object" && "voterId" in value ? (value as { voterId?: unknown }).voterId : undefined;
  return parseVoterId(voterId);
}

function idsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && isUuid(id)).slice(0, 40);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const voter = parseVoterId(url.searchParams.get("voterId"));
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((id) => isUuid(id));
  try {
    return jsonOk({ photos: listOwnedPhotos(ids, voter.voterId) });
  } catch (error) {
    console.error("Failed to load saved photos", safeErrorText(error));
    return jsonError(500, "SERVER", "The photos didn't load. Try again.");
  }
}

export async function POST(request: Request) {
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const voter = voterFrom(body.value);
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }
  const record = body.value as { email?: unknown; phone?: unknown; ids?: unknown };
  try {
    if (record.email || record.phone) {
      const found = findOwnedPhotosByContact({ email: record.email, phone: record.phone }, voter.voterId);
      if (!found.ok) return jsonError(400, found.code, found.message, found.fields);
      return jsonOk({ photos: found.photos });
    }
    return jsonOk({ photos: listOwnedPhotos(idsFrom(record.ids), voter.voterId) });
  } catch (error) {
    console.error("Failed to find saved photos", safeErrorText(error));
    return jsonError(500, "SERVER", "The photos didn't load. Try again.");
  }
}
