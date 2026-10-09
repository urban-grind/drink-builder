import { jsonError, jsonOk } from "@/lib/api";
import { drawProgress } from "@/lib/draw-entry";
import { readPhotoJson } from "@/lib/photo-http";
import { DECK_PAGE_SIZE, listPhotoDeck, swipeDeckPhoto } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid, parseVoterId } from "@/lib/validation";
import { networkHashFrom } from "@/lib/vote-network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function voterFrom(value: unknown) {
  const voterId =
    value && typeof value === "object" && "voterId" in value ? (value as { voterId?: unknown }).voterId : undefined;
  return parseVoterId(voterId);
}

function deckLimit(value: string | null): number {
  if (!value) return DECK_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DECK_PAGE_SIZE;
  return parsed;
}

function exceptIds(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => isUuid(part))
    .slice(0, 32);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const voter = parseVoterId(url.searchParams.get("voterId"));
  if (!voter.ok) {
    return jsonError(400, "VALIDATION", "That voter id is not valid.", {
      voterId: "Send the voter id stored in this browser.",
    });
  }
  try {
    return jsonOk({
      photos: listPhotoDeck(voter.voterId, {
        limit: deckLimit(url.searchParams.get("limit")),
        except: exceptIds(url.searchParams.get("except")),
      }),
    });
  } catch (error) {
    console.error("Failed to load the deck", safeErrorText(error));
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
  const record = body.value as { photoId?: unknown; action?: unknown };
  if (typeof record.photoId !== "string" || !isUuid(record.photoId)) {
    return jsonError(404, "NOT_FOUND", "That photo isn't here.");
  }
  if (record.action !== "vote" && record.action !== "skip") {
    return jsonError(400, "VALIDATION", "Choose vote or skip.");
  }
  try {
    const result = swipeDeckPhoto(
      record.photoId,
      voter.voterId,
      record.action,
      networkHashFrom(request.headers),
    );
    if (!result.ok) {
      if (result.code === "SIGNUP_REQUIRED") {
        return jsonError(403, result.code, "Sign up to keep swiping.");
      }
      const status = result.code === "NOT_FOUND" ? 404 : 409;
      const message = result.code === "NOT_FOUND" ? "That photo isn't here." : "You already passed on this photo.";
      return jsonError(status, result.code, message);
    }
    return jsonOk({ photo: result.photo, ...drawProgress(voter.voterId) });
  } catch (error) {
    console.error("Failed to save a swipe", safeErrorText(error));
    return jsonError(500, "SERVER", "That swipe didn't go through. Try again.");
  }
}
