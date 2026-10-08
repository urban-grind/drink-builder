import { jsonError, jsonOk } from "@/lib/api";
import { recordContestEvent } from "@/lib/contest-stats";
import { readPhotoJson } from "@/lib/photo-http";
import { sameOrigin } from "@/lib/photo-auth";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "FORBIDDEN", "Open the page on this site.");
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;
  const record = body.value as { visitorId?: unknown; kind?: unknown; name?: unknown };
  if (typeof record.visitorId !== "string") return jsonError(400, "VALIDATION", "That visit wasn't counted.");
  try {
    const saved = recordContestEvent(record.visitorId, record.kind, record.name);
    if (!saved) return jsonError(400, "VALIDATION", "That visit wasn't counted.");
    return jsonOk({ ok: true });
  } catch (error) {
    console.error("Failed to count a contest visit", safeErrorText(error));
    return jsonError(500, "SERVER", "That visit wasn't counted.");
  }
}
