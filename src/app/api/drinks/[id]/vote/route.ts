import { jsonError, jsonOk } from "@/lib/api";
import { castVote } from "@/lib/drinks";
import { isUuid, parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";

const messages = {
  NOT_FOUND: "That drink isn't on the board.",
  ALREADY_VOTED: "You already voted for this drink.",
} as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", messages.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "BAD_JSON", "Send the vote as JSON.");
  }

  const voterId =
    body && typeof body === "object" && "voterId" in body
      ? (body as { voterId?: unknown }).voterId
      : undefined;
  const voter = parseVoterId(voterId);
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }

  try {
    const result = castVote(id, voter.voterId);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 409;
      return jsonError(status, result.code, messages[result.code]);
    }
    return jsonOk({ drink: result.drink });
  } catch (error) {
    console.error("Failed to save vote", error);
    return jsonError(500, "SERVER", "The vote didn't go through. Try again.");
  }
}

export async function DELETE() {
  return jsonError(409, "VOTE_IS_FINAL", "A vote can't be taken back.");
}
