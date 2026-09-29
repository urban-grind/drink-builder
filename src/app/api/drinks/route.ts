import { jsonError, jsonOk } from "@/lib/api";
import { backfillCupPhotos, createDrink, listBoard } from "@/lib/drinks";
import { parseVoterId, validatePublish } from "@/lib/validation";

export const runtime = "nodejs";

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
    await backfillCupPhotos();
    return jsonOk(listBoard(voterId));
  } catch (error) {
    console.error("Failed to list drinks", error);
    return jsonError(500, "SERVER", "The board didn't load. Try again.");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "BAD_JSON", "Send the drink as JSON.");
  }

  const parsed = validatePublish(body);
  if (!parsed.ok) {
    return jsonError(400, "VALIDATION", parsed.message, parsed.fields);
  }

  try {
    const result = await createDrink(parsed.value);
    if (!result.ok) {
      return jsonError(
        409,
        "EMAIL_IN_USE",
        "That email already published a drink. Each email gets one cup on the board.",
        { creatorEmail: "That email already published a drink." },
      );
    }
    return jsonOk({ drink: result.drink }, 201);
  } catch (error) {
    console.error("Failed to create drink", error);
    return jsonError(500, "SERVER", "The drink didn't publish. Try again.");
  }
}
