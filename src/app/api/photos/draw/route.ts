import { jsonError, jsonOk } from "@/lib/api";
import { claimDrawEntrant, drawEntrantProfile, drawProgress, saveDrawEntrant } from "@/lib/draw-entry";
import { readPhotoJson } from "@/lib/photo-http";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid, parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function photoIdsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && isUuid(id)).slice(0, 40);
}

export async function POST(request: Request) {
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const record = body.value as {
    voterId?: unknown;
    photoIds?: unknown;
    personName?: unknown;
    profile?: unknown;
  };
  const voter = parseVoterId(record.voterId);
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }

  try {
    if (record.profile === true) {
      const profile = drawEntrantProfile(voter.voterId);
      return jsonOk({ personName: profile?.personName ?? "", contact: profile?.contact ?? "" });
    }
    if (typeof record.personName === "string") {
      const saved = saveDrawEntrant(voter.voterId, record);
      if (!saved.ok) return jsonError(400, saved.code, saved.message, saved.fields);
      return jsonOk(drawProgress(voter.voterId));
    }
    claimDrawEntrant(voter.voterId, photoIdsFrom(record.photoIds));
    return jsonOk(drawProgress(voter.voterId));
  } catch (error) {
    console.error("Failed to save a draw entry", safeErrorText(error));
    return jsonError(500, "SERVER", "That didn't save. Try again.");
  }
}
