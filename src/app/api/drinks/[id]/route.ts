import { jsonError, jsonOk } from "@/lib/api";
import { getDrink } from "@/lib/drinks";
import { isUuid, parseVoterId } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return jsonError(404, "NOT_FOUND", "That drink isn't on the board.");
  }

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
    const drink = getDrink(id, voterId);
    if (!drink) return jsonError(404, "NOT_FOUND", "That drink isn't on the board.");
    return jsonOk({ drink });
  } catch (error) {
    console.error("Failed to load drink", error);
    return jsonError(500, "SERVER", "This drink didn't load. Try again.");
  }
}
