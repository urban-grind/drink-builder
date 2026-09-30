import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import { castPhotoVote } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid, parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messages = {
  NOT_FOUND: "That photo isn't on the board.",
  ALREADY_VOTED: "You already voted for this photo.",
} as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", messages.NOT_FOUND);

  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;

  const voterId =
    body.value && typeof body.value === "object" && "voterId" in body.value
      ? (body.value as { voterId?: unknown }).voterId
      : undefined;
  const voter = parseVoterId(voterId);
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }

  try {
    const result = castPhotoVote(id, voter.voterId);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 409;
      return jsonError(status, result.code, messages[result.code]);
    }
    return jsonOk({ photo: result.photo });
  } catch (error) {
    console.error("Failed to save photo vote", safeErrorText(error));
    return jsonError(500, "SERVER", "The vote didn't go through. Try again.");
  }
}

export async function DELETE() {
  return jsonError(409, "VOTE_IS_FINAL", "A vote can't be taken back.");
}
